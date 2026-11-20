/**
 * Read layer. Maps Drizzle rows onto the shapes in `app/types.ts` so views keep their
 * current props and stay unaware of where the data came from (spec D3).
 *
 * Derived values are computed here rather than stored (schema-v1 F2).
 */
import { and, asc, desc, eq, isNull, lte, ne, sql } from "drizzle-orm";

import { getDb } from "./index";
import {
  campaigns, channels, conversations, customerSegments,
  inventoryChannelSync,
  dashboardMetrics, inventoryLevels, messages, orderLines, orders, payouts,
  products, recommendations, regions, shops,
} from "./schema";
import {
  bangkokDay, formatBaht, formatChange, formatCompactBaht, formatMessageStamp, formatPercent,
  formatRoas, formatThaiDay, formatTime, trendArrow,
} from "../app/format";
import type {
  Campaign, ChannelConnection, ChannelSyncRow, Conversation, DashboardMetrics, InventoryItem,
  Order, PeriodFigures, Payout, RecommendationPanel,
} from "../app/types";
import { bangkokDayStart, coverageOf, loadAnchor, loadPerformance, PERIODS, profitOf, salesVelocity, weeklySeries, windowsFor, type PeriodPerformance } from "./performance";
import { daysLeftOf, restockQuantity, STOCK_WARN_DAYS } from "./brief";

/**
 * Every read takes the caller's session and scopes to `session.shopId`.
 *
 * Threaded explicitly rather than through ambient context (auth spec): an unscoped query
 * then fails to compile instead of silently returning another shop's data. The session
 * rather than a bare shopId because PIN-0013 needs the role at this same layer.
 */
import type { SessionUser } from "./auth";
import { listChannelHealth, loadChannels, requireChannel } from "./channels";
import { providerStatus } from "./channel-providers";

/**
 * Stock status is derived, not stored — storing it would bake in drift the moment
 * on_hand changes. Reproduces all five fixture rows exactly.
 */
function stockStatus(onHand: number, daysLeft: number | null): InventoryItem["status"] {
  if (onHand === 0) return "หมดสต๊อก";
  if (daysLeft !== null && daysLeft < STOCK_WARN_DAYS) return "ใกล้หมด";
  return "พร้อมขาย";
}

/**
 * The signed-in shop's own name (PIN-0014 follow-up).
 *
 * The sidebar used to print "ร้าน Mali Living" as a literal, so every shop was that shop.
 * Falsy is impossible — `shops.name` is `notNull` and the session's `shopId` is a foreign
 * key — but a missing row would mean the session outlived its shop, which is worth saying
 * rather than rendering "ร้าน undefined".
 */
export async function shopName(session: SessionUser): Promise<string> {
  const [row] = await getDb()
    .select({ name: shops.name })
    .from(shops)
    .where(eq(shops.id, session.shopId));

  return row?.name ?? "ร้านของคุณ";
}

/**
 * How many orders the Orders view lists. Since PIN-0027 the shop has sixty days of history —
 * thousands of orders — and all of them would be serialised to the client on every request.
 */
export const ORDER_LIST_LIMIT = 100;

/** The newest orders, up to `ORDER_LIST_LIMIT`. Pair with `countOrders` so the view can say how many it is not showing. */
export async function listOrders(session: SessionUser): Promise<Order[]> {
  const db = getDb();
  const rows = await db
    .select({
      externalId: orders.externalId,
      customerName: orders.customerName,
      channelCode: channels.code,
      totalSatang: orders.totalSatang,
      status: orders.status,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .innerJoin(channels, eq(channels.id, orders.channelId))
    .where(eq(orders.shopId, session.shopId))
    .orderBy(desc(orders.placedAt))
    .limit(ORDER_LIST_LIMIT);

  const known = await loadChannels(session);
  return rows.map((row) => ({
    id: row.externalId,
    customer: row.customerName,
    channel: requireChannel(known, row.channelCode).shortName,
    channelAccent: requireChannel(known, row.channelCode).accent,
    total: formatBaht(row.totalSatang),
    status: row.status,
    time: formatTime(row.placedAt),
  }));
}

export async function countOrders(session: SessionUser): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.shopId, session.shopId));
  return Number(row?.total ?? 0);
}

/**
 * "ครบ 3 ช่องทาง" when every channel is current, otherwise the ones that are behind.
 * Derived from `inventory_channel_sync` rather than the deprecated prose column, so the
 * label cannot drift from the rows it describes.
 */
function syncLabel(states: { shortName: string; state: string }[]): string {
  const behind = states.filter((entry) => entry.state !== "synced");
  if (!states.length) return "ยังไม่ได้ซิงก์";
  if (!behind.length) return `ครบ ${states.length} ช่องทาง`;
  return `${behind.map((entry) => entry.shortName).join(", ")} รออัปเดต`;
}

export async function listInventory(session: SessionUser): Promise<InventoryItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      onHand: inventoryLevels.onHand,
      reserved: inventoryLevels.reserved,
      unitCostSatang: products.unitCostSatang,
    })
    .from(inventoryLevels)
    .innerJoin(products, eq(products.id, inventoryLevels.productId))
    .where(eq(inventoryLevels.shopId, session.shopId))
    .orderBy(asc(inventoryLevels.id));

  const syncRows = await db
    .select({
      productId: inventoryChannelSync.productId,
      shortName: channels.shortName,
      state: inventoryChannelSync.state,
    })
    .from(inventoryChannelSync)
    .innerJoin(channels, eq(channels.id, inventoryChannelSync.channelId))
    .where(eq(inventoryChannelSync.shopId, session.shopId))
    .orderBy(asc(inventoryChannelSync.channelId));

  // computed from sales since PIN-0031 — the stored days_left described a smaller shop
  const velocity = await salesVelocity(session, (await loadAnchor(session)).anchor);
  // cost is owner-only (spec Q5): staff never get the query, let alone the numbers
  const isOwner = session.role === "owner";
  const uncostedLines = isOwner
    ? new Map(
        (
          await db
            .select({ productId: orderLines.productId, n: sql<number>`count(*)`.as("n") })
            .from(orderLines)
            .where(and(eq(orderLines.shopId, session.shopId), isNull(orderLines.unitCostSatang)))
            .groupBy(orderLines.productId)
        ).map((row) => [row.productId, Number(row.n)])
      )
    : null;
  return rows.map((row) => {
    const daysLeft = daysLeftOf(row.onHand, velocity.get(row.productId)?.unitsPerDay);
    return {
      sku: row.sku,
      name: row.name,
      category: row.category,
      stock: row.onHand,
      reserved: row.reserved,
      daysLeft: daysLeft === null ? null : Math.floor(daysLeft),
      sync: syncLabel(syncRows.filter((entry) => entry.productId === row.productId)),
      status: stockStatus(row.onHand, daysLeft),
      ...(uncostedLines
        ? { cost: { unitCostSatang: row.unitCostSatang, uncostedLines: uncostedLines.get(row.productId) ?? 0 } }
        : {}),
    };
  });
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

  const known = await loadChannels(session);
  return rows.map((row) => ({
    id: row.id,
    name: row.customerName,
    channel: requireChannel(known, row.channelCode).shortName,
    channelAccent: requireChannel(known, row.channelCode).accent,
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

  const known = await loadChannels(session);
  return rows.map((row) => ({
    name: row.name,
    channel: requireChannel(known, row.channelCode).shortName,
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
      accent: channels.accent,
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
    expectedOn: row.expectedOn,
    platform: row.platform,
    accent: row.accent,
    date: formatThaiDay(row.expectedOn),
    orders: `${row.orderCount} ออเดอร์`,
    amount: formatBaht(row.amountSatang),
    status: row.status,
  }));
}

/** One period's figures, formatted. Profit and its coverage always travel together. */
function periodFigures({ current, previous }: PeriodPerformance): PeriodFigures {
  const profit = formatChange(profitOf(current), profitOf(previous));
  const sales = formatChange(current.salesSatang, previous.salesSatang);
  const count = formatChange(current.orders, previous.orders);
  const coverage = coverageOf(current);
  return {
    profit: formatBaht(profitOf(current)),
    sales: formatBaht(current.salesSatang),
    ads: formatBaht(current.adsSatang),
    orders: current.orders.toLocaleString("en-US"),
    change: profit.text,
    changeTrend: profit.trend,
    salesChange: sales.text,
    salesTrend: sales.trend,
    ordersChange: count.text,
    ordersTrend: count.trend,
    // floored, so 99.97% never rounds up to a "100%" that would hide the missing cost
    coverage: `${Math.floor(coverage * 10) / 10}%`,
    partial: coverage < 100,
  };
}

/**
 * The dashboard's figures.
 *
 * Since PIN-0027 the sales, ads, orders and profit figures — the Today card, its channel
 * table, the Money hero and waterfall, the Orders count tiles — are computed from orders
 * (`./performance`). The rest are still the presentation rows PIN-0009 transcribed from JSX:
 * segments, regions, restock, opportunities and the other views' tiles, until they get the
 * same treatment. `channel_metrics`, `waterfall_steps` and the period rows of
 * `dashboard_metrics` are no longer read.
 */
export async function listDashboardMetrics(session: SessionUser): Promise<DashboardMetrics> {
  const db = getDb();
  const where = eq(dashboardMetrics.shopId, session.shopId);

  const [metricRows, segmentRows, regionRows, performance, known, inventory] =
    await Promise.all([
      db.select().from(dashboardMetrics).where(where).orderBy(asc(dashboardMetrics.sortOrder)),
      db.select().from(customerSegments).where(eq(customerSegments.shopId, session.shopId)).orderBy(asc(customerSegments.sortOrder)),
      db.select().from(regions).where(eq(regions.shopId, session.shopId)).orderBy(asc(regions.sortOrder)),
      loadPerformance(session),
      loadChannels(session),
      db
        .select({
          productId: products.id,
          name: products.name,
          onHand: inventoryLevels.onHand,
          unitCostSatang: products.unitCostSatang,
        })
        .from(inventoryLevels)
        .innerJoin(products, eq(products.id, inventoryLevels.productId))
        .where(eq(inventoryLevels.shopId, session.shopId))
        .orderBy(asc(inventoryLevels.id)),
    ]);
  const anchor = performance.anchor.getTime();
  const anchorIso = performance.anchor.toISOString();
  const [statusCounts, figures, velocity, priorVelocity, weekly] = await Promise.all([
    orderStatusCounts(session, anchor),
    shopFigures(session, anchor),
    salesVelocity(session, anchor),
    salesVelocity(session, anchor - 7 * 24 * 60 * 60_000),
    weeklySeries(session, anchor, 8),
  ]);
  const isOwner = session.role === "owner";

  const render = (row: (typeof metricRows)[number]): string => {
    if (row.unit === "satang") return formatBaht(row.valueSatang ?? 0);
    if (row.unit === "percent") return formatPercent(row.valueNum ?? 0);
    if (row.unit === "minutes") return `${row.valueNum ?? 0} นาที`;
    if (row.unit === "ratio") return (row.valueNum ?? 0).toFixed(2);
    return (row.valueNum ?? 0).toLocaleString("en-US");
  };

  const periods: DashboardMetrics["periods"] = {};
  for (const period of PERIODS) periods[period.key] = periodFigures(performance.periods[period.key]);
  const today = performance.periods[PERIODS[0].key].current;
  const todayFigures = periods[PERIODS[0].key];

  /**
   * Tiles whose figure is now computed. The stored row still supplies the label and sort
   * order; value and note come from here, so a stale stored number cannot reach the screen.
   */
  const isToday = bangkokDay(anchorIso) === bangkokDay(new Date().toISOString());

  // Stock, from the same days-left the brief and the Stock view use (PIN-0030).
  const stock = inventory.map((row) => {
    const daysLeft = daysLeftOf(row.onHand, velocity.get(row.productId)?.unitsPerDay);
    return { ...row, daysLeft, status: stockStatus(row.onHand, daysLeft) };
  });
  const countOf = (status: InventoryItem["status"]) => stock.filter((row) => row.status === status).length;
  const lowOrOut = countOf("ใกล้หมด") + countOf("หมดสต๊อก");
  const uncostedStock = stock.filter((row) => row.unitCostSatang === null).length;
  const stockValue = stock.reduce((sum, row) => sum + Math.max(row.onHand, 0) * (row.unitCostSatang ?? 0), 0);
  // ROAS over the channels that advertised today: their sales ÷ their spend. No target exists.
  const advertised = [...performance.channels.values()].filter((totals) => totals.adsSatang > 0);
  const adSpendToday = advertised.reduce((sum, totals) => sum + totals.adsSatang, 0);
  const adChannelSales = advertised.reduce((sum, totals) => sum + totals.salesSatang, 0);
  const example = { value: "", note: "", example: true } as const;
  const computed: Record<string, Record<string, { label?: string; value: string; note: string; trend?: "up" | "down" | "warning"; example?: boolean }>> = {
    today: {
      quick_pack: { value: String(statusCounts.toPack), note: `${statusCounts.toPack.toLocaleString("en-US")} รายการรอแพ็ก` },
      quick_reply: { value: String(figures.unread), note: `${figures.unread.toLocaleString("en-US")} ข้อความรอตอบ` },
      quick_restock: { value: String(lowOrOut), note: `${lowOrOut.toLocaleString("en-US")} รายการใกล้หมดหรือหมด` },
      quick_campaign: { value: todayFigures.ads, note: `ค่าโฆษณา ${todayFigures.ads}` },
      pending_payout: example,
    },
    stock: {
      sellable: { value: countOf("พร้อมขาย").toLocaleString("en-US"), note: `จากทั้งหมด ${stock.length.toLocaleString("en-US")} สินค้า`, trend: "up" },
      low: { value: countOf("ใกล้หมด").toLocaleString("en-US"), note: "จะหมดภายใน 7 วันตามยอดขาย", trend: "warning" },
      out: { value: countOf("หมดสต๊อก").toLocaleString("en-US"), note: "ขายไม่ได้ทุกช่องทาง", trend: "warning" },
      value: {
        label: "มูลค่าสต๊อก (ทุน)",
        value: formatBaht(stockValue),
        note: uncostedStock ? `ไม่รวม ${uncostedStock} สินค้าที่ยังไม่มีต้นทุน` : "คิดจากต้นทุนต่อชิ้น",
      },
    },
    inbox: {
      today: { value: figures.messagesToday.toLocaleString("en-US"), note: "ทุกช่องทาง" },
      waiting: { value: figures.unread.toLocaleString("en-US"), note: `จาก ${figures.unreadChats.toLocaleString("en-US")} แชต`, trend: "warning" },
      response_time: example,
      chat_sales: example,
    },
    growth: {
      ad_sales: example,
      ad_spend: { value: formatBaht(adSpendToday), note: `${advertised.length} ช่องทางที่ลงโฆษณา` },
      roas: {
        value: adSpendToday > 0 ? formatRoas(adSpendToday, adChannelSales) : "—",
        note: "ยอดขายช่องทางที่ลงโฆษณา ÷ ค่าโฆษณา",
      },
      ad_profit: example,
    },
    orders: {
      new: {
        value: todayFigures.orders,
        note: `${trendArrow(todayFigures.ordersTrend)} ${todayFigures.ordersChange} จากช่วงเดียวกันเมื่อวาน`,
        trend: todayFigures.ordersTrend === "down" ? "down" : "up",
      },
      to_pack: { value: statusCounts.toPack.toLocaleString("en-US"), note: "รวมทุกช่องทาง" },
      to_review: { value: statusCounts.toReview.toLocaleString("en-US"), note: "มีความเสี่ยงผิดปกติ", trend: "warning" },
      delivered: { value: statusCounts.deliveredThisWeek.toLocaleString("en-US"), note: "ในรอบ 7 วัน", trend: "up" },
    },
    money: {
      profit: {
        // the stored label says วันนี้; the figure is the anchor's day, which may not be today
        label: `กำไรโดยประมาณ${isToday ? "วันนี้" : ` ${formatThaiDay(anchorIso)}`}`,
        value: todayFigures.profit,
        note: todayFigures.partial ? `ต้นทุนครบ ${todayFigures.coverage} ของยอดขาย` : "ต้นทุนครบทุกรายการ",
        trend: todayFigures.changeTrend === "down" ? "down" : "up",
      },
      withdrawable: example,
      pending: example,
    },
  };

  const tiles: DashboardMetrics["tiles"] = {};
  for (const row of metricRows) {
    if (row.period) continue; // superseded by `periods`, computed above
    // stock value is at cost, and cost is the owner's (PIN-0028)
    if (row.scope === "stock" && row.metricKey === "value" && !isOwner) continue;
    const override = computed[row.scope]?.[row.metricKey];
    // an example keeps its stored figure, labelled; a computed one replaces it
    const isExample = override?.example === true;
    const trend = override && !isExample ? override.trend : row.trend && row.trend !== "neutral" ? row.trend : undefined;
    (tiles[row.scope] ??= []).push({
      key: row.metricKey,
      label: (!isExample && override?.label) || row.label,
      value: (!isExample && override?.value) || render(row),
      note: isExample ? row.note ?? "" : override?.note ?? row.note ?? "",
      ...(trend ? { trend } : {}),
      ...(isExample ? { example: true } : {}),
    });
  }

  // the widest bar is the reference; the fixtures' 100/38/28/22/19 fall straight out of this
  const widestShare = Math.max(...regionRows.map((r) => r.sharePercent), 1);

  const channelIdentity = new Map([...known.values()].map((channel) => [channel.id, channel]));
  const channelRows = [...performance.channels.entries()]
    .filter(([, totals]) => totals.orders > 0 || totals.adsSatang > 0)
    .sort(([, a], [, b]) => b.salesSatang - a.salesSatang);

  const profit = profitOf(today);
  // Sales is the tallest bar at 72% of the chart, as the stylesheet drew it; the rest are to scale.
  const barHeight = (satang: number) =>
    today.salesSatang > 0 ? Math.max(2, Math.round((satang / today.salesSatang) * 72)) : 0;

  const tallest = Math.max(1, ...weekly.map((week) => Math.max(week.salesSatang - week.cogsSatang - week.adsSatang, week.cogsSatang)));
  const pct = (satang: number) => Math.max(0, Math.round((satang / tallest) * 100));
  const todayLabel = isToday ? "วันนี้" : ` วันที่ ${formatThaiDay(anchorIso)}`;

  return {
    asOf: {
      time: formatTime(anchorIso),
      day: formatThaiDay(anchorIso),
      isToday,
      synced: performance.synced,
      date: bangkokDay(anchorIso),
    },
    kickers: {
      orders: `${todayFigures.orders} ออเดอร์${todayLabel}`,
      inbox: `${figures.unread.toLocaleString("en-US")} ข้อความรอตอบ`,
      stock: `สินค้า ${stock.length.toLocaleString("en-US")} รายการ`,
      customers: `ลูกค้า ${figures.customers.toLocaleString("en-US")} คนใน 60 วัน`,
    },
    weekly: weekly.map((week) => ({
      label: formatThaiDay(new Date(week.endsAt).toISOString()),
      profit: pct(week.salesSatang - week.cogsSatang - week.adsSatang),
      cost: pct(week.cogsSatang),
    })),
    periods,
    uncosted: performance.uncosted,
    tiles,
    channels: channelRows.map(([channelId, totals]) => {
      const channel = channelIdentity.get(channelId);
      if (!channel) throw new Error(`Orders reference channel ${channelId}, which this shop does not have.`);
      return {
        channel: channel.displayName,
        code: channel.accent,
        sales: formatBaht(totals.salesSatang),
        orders: totals.orders.toLocaleString("en-US"),
        profit: formatBaht(profitOf(totals)),
        margin: totals.salesSatang > 0 ? formatPercent((profitOf(totals) / totals.salesSatang) * 100) : "—",
      };
    }),
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
    // Fees and shipping are not here because nothing supplies them yet; the view says so.
    waterfall: [
      { label: "ยอดขาย", amount: formatCompactBaht(today.salesSatang), kind: "sales", height: barHeight(today.salesSatang) },
      { label: "ต้นทุนสินค้า", amount: `−${formatCompactBaht(today.cogsSatang)}`, kind: "cost", height: barHeight(today.cogsSatang) },
      { label: "โฆษณา", amount: `−${formatCompactBaht(today.adsSatang)}`, kind: "ads", height: barHeight(today.adsSatang) },
      { label: "กำไร", amount: `${profit < 0 ? "−" : ""}${formatCompactBaht(Math.abs(profit))}`, kind: "profit", height: barHeight(Math.abs(profit)) },
    ],
    // the brief's quantities: enough for 14 days at the current rate
    restock: stock
      .filter((row) => row.status !== "พร้อมขาย" && velocity.get(row.productId))
      .map((row) => ({ name: row.name, quantity: `+${restockQuantity(row.onHand, velocity.get(row.productId)!.unitsPerDay).toLocaleString("en-US")} ชิ้น` })),
    // sales this week against last, and the week's profit before ads where every unit is costed
    opportunities: stock
      .map((row) => ({ row, now: velocity.get(row.productId), before: priorVelocity.get(row.productId) }))
      .filter((entry) => entry.now && entry.before && entry.before.revenuePerDaySatang > 0)
      .map((entry) => ({ ...entry, growth: (entry.now!.revenuePerDaySatang / entry.before!.revenuePerDaySatang - 1) * 100 }))
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 3)
      .map((entry, rank) => ({
        name: entry.row.name,
        metric: `${entry.growth >= 0 ? "ขายเพิ่ม" : "ขายลดลง"} ${formatPercent(Math.abs(entry.growth))} จากสัปดาห์ก่อน`,
        // per-product profit and units would give away unit cost, which is the owner's (PIN-0028)
        profit: !isOwner
          ? `ยอดขาย ${formatBaht(entry.now!.revenuePerDaySatang * 7)} / 7 วัน`
          : entry.now!.uncostedUnits > 0
            ? "ยังไม่มีต้นทุน คิดกำไรไม่ได้"
            : `กำไรก่อนโฆษณา ${formatBaht((entry.now!.revenuePerDaySatang - entry.now!.cogsPerDaySatang) * 7)} / 7 วัน`,
        accent: ["cream", "amber", "blue"][rank],
      })),
  };
}

/** Counts the headings and tiles quote (PIN-0030): unread messages, today's messages, customers in 60 days. */
async function shopFigures(
  session: SessionUser,
  anchor: number
): Promise<{ unread: number; unreadChats: number; messagesToday: number; customers: number }> {
  const db = getDb();
  const dayStart = new Date(bangkokDayStart(anchor)).toISOString();
  const [[unread], [today], [customers]] = await Promise.all([
    db
      .select({
        messages: sql<number>`coalesce(sum(${conversations.unreadCount}), 0)`.as("messages"),
        chats: sql<number>`coalesce(sum(case when ${conversations.unreadCount} > 0 then 1 else 0 end), 0)`.as("chats"),
      })
      .from(conversations)
      .where(eq(conversations.shopId, session.shopId)),
    db
      .select({ n: sql<number>`count(*)`.as("n") })
      .from(messages)
      .where(and(eq(messages.shopId, session.shopId), sql`${messages.sentAt} >= ${dayStart}`, lte(messages.sentAt, new Date(anchor).toISOString()))),
    db
      .select({ n: sql<number>`count(distinct ${orders.customerName})`.as("n") })
      .from(orders)
      .where(and(eq(orders.shopId, session.shopId), sql`${orders.placedAt} > ${new Date(anchor - 60 * 24 * 60 * 60_000).toISOString()}`, lte(orders.placedAt, new Date(anchor).toISOString()))),
  ]);
  return {
    unread: Number(unread?.messages ?? 0),
    unreadChats: Number(unread?.chats ?? 0),
    messagesToday: Number(today?.n ?? 0),
    customers: Number(customers?.n ?? 0),
  };
}

/**
 * Work waiting on the shop, by order status. Pending work counts regardless of age — an
 * order still unpacked from yesterday is still unpacked — while "delivered" is the last
 * seven days, since a running total since the shop opened says nothing.
 */
async function orderStatusCounts(
  session: SessionUser,
  anchor: number
): Promise<{ toPack: number; toReview: number; deliveredThisWeek: number }> {
  const week = windowsFor(anchor, 7).current;
  const [row] = await getDb()
    .select({
      toPack: sql<number>`coalesce(sum(case when ${orders.status} = 'รอแพ็ก' then 1 else 0 end), 0)`.as("to_pack"),
      toReview: sql<number>`coalesce(sum(case when ${orders.status} = 'ตรวจสอบ' then 1 else 0 end), 0)`.as("to_review"),
      deliveredThisWeek: sql<number>`coalesce(sum(case when ${orders.status} = 'จัดส่งแล้ว' and ${orders.placedAt} >= ${new Date(week.from).toISOString()} then 1 else 0 end), 0)`.as("delivered_this_week"),
    })
    .from(orders)
    .where(and(eq(orders.shopId, session.shopId), lte(orders.placedAt, new Date(anchor).toISOString())));
  return {
    toPack: Number(row?.toPack ?? 0),
    toReview: Number(row?.toReview ?? 0),
    deliveredThisWeek: Number(row?.deliveredThisWeek ?? 0),
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


const SYNC_LABEL: Record<string, { label: string; tone: string }> = {
  healthy: { label: "ปกติ", tone: "good" },
  syncing: { label: "กำลังซิงก์", tone: "neutral" },
  degraded: { label: "ต้องตรวจสอบ", tone: "warning" },
  disconnected: { label: "ยังไม่เชื่อมต่อ", tone: "danger" },
};

/** "ซิงก์ล่าสุด 37 นาทีที่แล้ว" — the grid's subtitle, from a real timestamp. */
function lastSyncedLabel(iso: string | null): string {
  if (!iso) return "ยังไม่เคยซิงก์";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "ซิงก์ล่าสุดเมื่อครู่นี้";
  if (minutes < 60) return `ซิงก์ล่าสุด ${minutes} นาทีที่แล้ว`;
  return `ซิงก์ล่าสุด ${Math.round(minutes / 60)} ชั่วโมงที่แล้ว`;
}

/**
 * StockView's sync grid. It was three hardcoded blocks that always read "ปกติ", so it
 * could never show a real problem — the one thing a sync indicator is for.
 */
/**
 * Every channel and whether it can actually be connected (PIN-0025).
 *
 * The state comes from `channel_health`; `connectable` comes from whether a provider exists
 * and has credentials. Those are separate questions — a channel can be disconnected *and*
 * unconnectable, which is exactly today's situation for Shopee and TikTok, and the screen has
 * to say both rather than offering a button that would do nothing.
 */
export async function listChannelConnections(session: SessionUser): Promise<ChannelConnection[]> {
  const reports = await listChannelHealth(session, { includeAds: true });

  return reports.map((report) => {
    const status = providerStatus(report.channel.code);
    return {
      code: report.channel.code,
      displayName: report.channel.displayName,
      accent: report.channel.accent,
      kind: report.channel.kind,
      state: report.state,
      label: SYNC_LABEL[report.state].label,
      tone: SYNC_LABEL[report.state].tone,
      detail: report.detail ?? "",
      // Formatted here like every other display string (spec D3), so the view never sees
      // an ISO timestamp. The raw value leaked into the card as 2026-09-09T17:13:24.547Z.
      lastSyncedAt: report.lastSyncedAt ? formatMessageStamp(report.lastSyncedAt) : null,
      connectable: status?.configured === true,
      blockedReason:
        status === null
          ? "ช่องทางนี้ยังไม่รองรับการเชื่อมต่ออัตโนมัติ"
          : status.configured
            ? ""
            : status.reason,
    };
  });
}

export async function listChannelSync(session: SessionUser): Promise<ChannelSyncRow[]> {
  const [reports, pending] = await Promise.all([
    listChannelHealth(session),
    getDb()
      .select({ channelId: inventoryChannelSync.channelId, productId: inventoryChannelSync.productId })
      .from(inventoryChannelSync)
      .where(
        and(
          eq(inventoryChannelSync.shopId, session.shopId),
          ne(inventoryChannelSync.state, "synced")
        )
      ),
  ]);

  // Derived, not seeded: channel_health used to carry this sentence as prose alongside
  // inventory_levels.sync_state saying the same thing, and nothing kept the two agreeing.
  const behindCount = (channelId: number) =>
    pending.filter((row) => row.channelId === channelId).length;

  return reports.map((report) => ({
    code: report.channel.code,
    displayName: report.channel.displayName,
    accent: report.channel.accent,
    state: report.state,
    label: SYNC_LABEL[report.state].label,
    tone: SYNC_LABEL[report.state].tone,
    detail:
      report.detail ??
      (behindCount(report.channel.id) > 0
        ? `สต๊อก ${behindCount(report.channel.id)} รายการรออัปเดต`
        : lastSyncedLabel(report.lastSyncedAt)),
  }));
}
