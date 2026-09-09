/**
 * Read layer. Maps Drizzle rows onto the shapes in `app/types.ts` so views keep their
 * current props and stay unaware of where the data came from (spec D3).
 *
 * Derived values are computed here rather than stored (schema-v1 F2).
 */
import { and, asc, desc, eq, isNull, sum } from "drizzle-orm";

import { getDb } from "./index";
import {
  actions, campaigns, channelMetrics, channels, conversations, customerSegments,
  dashboardMetrics, inventoryLevels, messages, orders, payouts, productOpportunities,
  products, recommendations, regions, restockSuggestions, waterfallSteps,
} from "./schema";
import {
  formatBaht, formatCompactBaht, formatMessageStamp, formatPercent, formatRoas,
  formatThaiDay, formatTime, formatUpdatedAt,
} from "../app/format";
import type {
  Campaign, Conversation, DashboardMetrics, InventoryItem, Order, Payout,
  RecommendationPanel, ShopAction,
} from "../app/types";

/**
 * Every read takes the caller's session and scopes to `session.shopId`.
 *
 * Threaded explicitly rather than through ambient context (auth spec): an unscoped query
 * then fails to compile instead of silently returning another shop's data. The session
 * rather than a bare shopId because PIN-0013 needs the role at this same layer.
 */
import type { SessionUser } from "./auth";

/**
 * Stock status is derived, not stored — storing it would bake in drift the moment
 * on_hand changes. Reproduces all five fixture rows exactly.
 */
function stockStatus(onHand: number, daysLeft: number | null): InventoryItem["status"] {
  if (onHand === 0) return "หมดสต๊อก";
  if (daysLeft !== null && daysLeft <= 7) return "ใกล้หมด";
  return "พร้อมขาย";
}

export async function listOrders(session: SessionUser): Promise<Order[]> {
  const db = getDb();
  const rows = await db
    .select({
      externalId: orders.externalId,
      customerName: orders.customerName,
      channel: channels.displayName,
      channelCode: channels.code,
      totalSatang: orders.totalSatang,
      status: orders.status,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .innerJoin(channels, eq(channels.id, orders.channelId))
    .where(eq(orders.shopId, session.shopId))
    .orderBy(desc(orders.placedAt));

  return rows.map((row) => ({
    id: row.externalId,
    customer: row.customerName,
    // views render the short channel name and derive the logo class from it
    channel: row.channelCode === "line" ? "LINE" : row.channelCode === "shopee" ? "Shopee" : "TikTok",
    total: formatBaht(row.totalSatang),
    status: row.status,
    time: formatTime(row.placedAt),
  }));
}

export async function listInventory(session: SessionUser): Promise<InventoryItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      sku: products.sku,
      name: products.name,
      category: products.category,
      onHand: inventoryLevels.onHand,
      reserved: inventoryLevels.reserved,
      daysLeft: inventoryLevels.daysLeft,
      syncState: inventoryLevels.syncState,
    })
    .from(inventoryLevels)
    .innerJoin(products, eq(products.id, inventoryLevels.productId))
    .where(eq(inventoryLevels.shopId, session.shopId))
    .orderBy(asc(inventoryLevels.id));

  return rows.map((row) => ({
    sku: row.sku,
    name: row.name,
    category: row.category,
    stock: row.onHand,
    reserved: row.reserved,
    daysLeft: row.daysLeft ?? 0,
    sync: row.syncState,
    status: stockStatus(row.onHand, row.daysLeft),
  }));
}

export async function listActions(session: SessionUser): Promise<ShopAction[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.shopId, session.shopId), isNull(actions.resolvedAt)))
    .orderBy(asc(actions.id));

  return rows.map((row) => ({
    id: row.id,
    tone: row.tone,
    label: row.label,
    title: row.title,
    detail: row.detail,
    // rebuilt from the two stored parts rather than kept as a display string
    impact: `${row.impactKind} ${formatBaht(row.impactSatang)}`,
    impactSatang: row.impactSatang,
    channel: row.channelLabel,
    source: formatUpdatedAt(row.detectedAt),
    insight: row.insight,
    recommendation: row.recommendation,
  }));
}

export async function listConversations(session: SessionUser): Promise<Conversation[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      customerName: conversations.customerName,
      channelCode: channels.code,
      preview: conversations.preview,
      topic: conversations.topic,
      unreadCount: conversations.unreadCount,
      lastMessageAt: conversations.lastMessageAt,
      orderExternalId: orders.externalId,
    })
    .from(conversations)
    .innerJoin(channels, eq(channels.id, conversations.channelId))
    .leftJoin(orders, eq(orders.id, conversations.orderId))
    .where(eq(conversations.shopId, session.shopId))
    .orderBy(desc(conversations.lastMessageAt));

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.shopId, session.shopId))
    .orderBy(asc(messages.sentAt), asc(messages.id));

  return rows.map((row) => ({
    id: row.id,
    name: row.customerName,
    channel: row.channelCode === "line" ? "LINE" : row.channelCode === "shopee" ? "Shopee" : "TikTok",
    preview: row.preview,
    time: formatTime(row.lastMessageAt),
    unread: row.unreadCount,
    order: row.orderExternalId ?? "",
    topic: row.topic,
    messages: messageRows
      .filter((message) => message.conversationId === row.id)
      .map((message) => ({
        from: message.sender,
        text: message.body,
        time: formatMessageStamp(message.sentAt),
      })),
  }));
}

export async function listCampaigns(session: SessionUser): Promise<Campaign[]> {
  const db = getDb();
  const rows = await db
    .select({
      name: campaigns.name,
      channel: channels.displayName,
      channelCode: channels.code,
      spendSatang: campaigns.spendSatang,
      revenueSatang: campaigns.revenueSatang,
      health: campaigns.health,
    })
    .from(campaigns)
    .innerJoin(channels, eq(channels.id, campaigns.channelId))
    .where(eq(campaigns.shopId, session.shopId))
    .orderBy(asc(campaigns.id));

  return rows.map((row) => ({
    name: row.name,
    // the table shows the short platform name, not the ad-account name
    channel: row.channelCode === "tiktok_ads" ? "TikTok" : row.channel,
    spend: formatBaht(row.spendSatang),
    revenue: formatBaht(row.revenueSatang),
    roas: formatRoas(row.spendSatang, row.revenueSatang),
    health: row.health,
  }));
}

export async function listPayouts(session: SessionUser): Promise<Payout[]> {
  const db = getDb();
  const rows = await db
    .select({
      platform: channels.displayName,
      expectedOn: payouts.expectedOn,
      orderCount: payouts.orderCount,
      amountSatang: payouts.amountSatang,
      status: payouts.status,
    })
    .from(payouts)
    .innerJoin(channels, eq(channels.id, payouts.channelId))
    .where(eq(payouts.shopId, session.shopId))
    .orderBy(asc(payouts.expectedOn));

  return rows.map((row) => ({
    platform: row.platform,
    date: formatThaiDay(row.expectedOn),
    orders: `${row.orderCount} ออเดอร์`,
    amount: formatBaht(row.amountSatang),
    status: row.status,
  }));
}

/** Spec Q3: the Action Center headline stops being a literal and becomes a live sum. */
export async function openActionImpactTotal(session: SessionUser): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ total: sum(actions.impactSatang) })
    .from(actions)
    .where(and(eq(actions.shopId, session.shopId), isNull(actions.resolvedAt)));
  return formatBaht(Number(row?.total ?? 0));
}

/**
 * The presentation figures that were JSX literals until PIN-0009.
 *
 * Temporary scaffolding, like the tables behind it: once there is enough real data these
 * become aggregates over the domain tables. Values are stored as numbers and formatted
 * here, so nothing in a component is a display string any more.
 */
export async function listDashboardMetrics(session: SessionUser): Promise<DashboardMetrics> {
  const db = getDb();
  const where = eq(dashboardMetrics.shopId, session.shopId);

  const [metricRows, channelRows, segmentRows, regionRows, waterfallRows, restockRows, opportunityRows] =
    await Promise.all([
      db.select().from(dashboardMetrics).where(where).orderBy(asc(dashboardMetrics.sortOrder)),
      db
        .select({
          channel: channels.displayName,
          code: channels.code,
          salesSatang: channelMetrics.salesSatang,
          orderCount: channelMetrics.orderCount,
          profitSatang: channelMetrics.profitSatang,
        })
        .from(channelMetrics)
        .innerJoin(channels, eq(channels.id, channelMetrics.channelId))
        .where(eq(channelMetrics.shopId, session.shopId)),
      db.select().from(customerSegments).where(eq(customerSegments.shopId, session.shopId)).orderBy(asc(customerSegments.sortOrder)),
      db.select().from(regions).where(eq(regions.shopId, session.shopId)).orderBy(asc(regions.sortOrder)),
      db.select().from(waterfallSteps).where(eq(waterfallSteps.shopId, session.shopId)).orderBy(asc(waterfallSteps.sortOrder)),
      db
        .select({ name: products.name, quantity: restockSuggestions.suggestedQuantity })
        .from(restockSuggestions)
        .innerJoin(products, eq(products.id, restockSuggestions.productId))
        .where(eq(restockSuggestions.shopId, session.shopId))
        .orderBy(asc(restockSuggestions.sortOrder)),
      db
        .select({
          name: products.name,
          growthPercent: productOpportunities.growthPercent,
          profitSatang: productOpportunities.profitSatang,
          accent: productOpportunities.accent,
        })
        .from(productOpportunities)
        .innerJoin(products, eq(products.id, productOpportunities.productId))
        .where(eq(productOpportunities.shopId, session.shopId))
        .orderBy(asc(productOpportunities.sortOrder)),
    ]);

  const render = (row: (typeof metricRows)[number]): string => {
    if (row.unit === "satang") return formatBaht(row.valueSatang ?? 0);
    if (row.unit === "percent") return formatPercent(row.valueNum ?? 0);
    if (row.unit === "minutes") return `${row.valueNum ?? 0} นาที`;
    if (row.unit === "ratio") return (row.valueNum ?? 0).toFixed(2);
    return (row.valueNum ?? 0).toLocaleString("en-US");
  };

  const periods: DashboardMetrics["periods"] = {};
  const tiles: DashboardMetrics["tiles"] = {};
  for (const row of metricRows) {
    if (row.period) {
      const bucket = (periods[row.period] ??= { profit: "", sales: "", ads: "", orders: "", change: "" });
      if (row.metricKey in bucket) bucket[row.metricKey as keyof typeof bucket] = render(row);
      continue;
    }
    (tiles[row.scope] ??= []).push({
      key: row.metricKey,
      label: row.label,
      value: render(row),
      note: row.note ?? "",
      ...(row.trend && row.trend !== "neutral" ? { trend: row.trend } : {}),
    });
  }

  // the widest bar is the reference; the fixtures' 100/38/28/22/19 fall straight out of this
  const widestShare = Math.max(...regionRows.map((r) => r.sharePercent), 1);

  return {
    periods,
    tiles,
    channels: channelRows.map((row) => ({
      channel: row.channel,
      code: row.code,
      sales: formatBaht(row.salesSatang),
      orders: String(row.orderCount),
      profit: formatBaht(row.profitSatang),
      // derived, never stored
      margin: formatPercent((row.profitSatang / row.salesSatang) * 100),
    })),
    segments: segmentRows.map((row) => ({
      key: row.segmentKey,
      label: row.label,
      count: `${row.customerCount.toLocaleString("en-US")} คน`,
      note: row.note,
    })),
    regions: regionRows.map((row) => ({
      name: row.name,
      value: formatPercent(row.sharePercent),
      width: Math.round((row.sharePercent / widestShare) * 100),
    })),
    waterfall: waterfallRows.map((row) => ({
      label: row.label,
      amount: `${row.kind === "sales" || row.kind === "profit" ? "" : "−"}${formatCompactBaht(row.amountSatang)}`,
      kind: row.kind,
    })),
    restock: restockRows.map((row) => ({ name: row.name, quantity: `+${row.quantity} ชิ้น` })),
    opportunities: opportunityRows.map((row) => ({
      name: row.name,
      metric: `ขายเพิ่ม ${formatPercent(row.growthPercent)}`,
      profit: `กำไร ${formatBaht(row.profitSatang)}`,
      accent: row.accent,
    })),
  };
}

/**
 * The "Pinto แนะนำ" advisory panels (PIN-0010).
 *
 * Text is stored as a template with an `{amount}` placeholder; the amount lives in its own
 * integer column and is interpolated here. That keeps money an integer while leaving the
 * sentence intact — storing the finished sentence would freeze the number into prose.
 */
export async function listRecommendations(session: SessionUser): Promise<Record<string, RecommendationPanel>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.shopId, session.shopId))
    .orderBy(asc(recommendations.sortOrder));

  const fill = (template: string, satangValue: number | null) =>
    satangValue === null ? template : template.replace("{amount}", formatBaht(satangValue));

  return Object.fromEntries(
    rows.map((row) => [
      row.scope,
      {
        scope: row.scope,
        kicker: row.kicker,
        title: fill(row.titleTemplate, row.titleAmountSatang),
        body: fill(row.bodyTemplate, row.bodyAmountSatang),
        ...(row.figureLabel ? { figureLabel: row.figureLabel } : {}),
        ...(row.figureSatang !== null
          ? {
              figureValue:
                `${row.figurePrefix ?? ""}${formatBaht(row.figureSatang)}${row.figureSuffix ?? ""}`,
            }
          : {}),
        cta: row.ctaLabel,
        ...(row.secondaryCtaLabel ? { secondaryCta: row.secondaryCtaLabel } : {}),
      },
    ])
  );
}
