/**
 * Read layer. Maps Drizzle rows onto the shapes in `app/types.ts` so views keep their
 * current props and stay unaware of where the data came from (spec D3).
 *
 * Derived values are computed here rather than stored (schema-v1 F2).
 */
import { and, asc, desc, eq, isNull, sum } from "drizzle-orm";

import { getDb } from "./index";
import {
  actions, campaigns, channels, conversations, inventoryLevels, messages, orders, payouts, products,
} from "./schema";
import {
  formatBaht, formatMessageStamp, formatRoas, formatThaiDay, formatTime, formatUpdatedAt,
} from "../app/format";
import type {
  Campaign, Conversation, InventoryItem, Order, Payout, ShopAction,
} from "../app/types";

/** The single seeded demo shop. Milestone 4 replaces this with the authenticated shop. */
const SHOP_ID = 1;

/**
 * Stock status is derived, not stored — storing it would bake in drift the moment
 * on_hand changes. Reproduces all five fixture rows exactly.
 */
function stockStatus(onHand: number, daysLeft: number | null): InventoryItem["status"] {
  if (onHand === 0) return "หมดสต๊อก";
  if (daysLeft !== null && daysLeft <= 7) return "ใกล้หมด";
  return "พร้อมขาย";
}

export async function listOrders(): Promise<Order[]> {
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
    .where(eq(orders.shopId, SHOP_ID))
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

export async function listInventory(): Promise<InventoryItem[]> {
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
    .where(eq(inventoryLevels.shopId, SHOP_ID))
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

export async function listActions(): Promise<ShopAction[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.shopId, SHOP_ID), isNull(actions.resolvedAt)))
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

export async function listConversations(): Promise<Conversation[]> {
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
    .where(eq(conversations.shopId, SHOP_ID))
    .orderBy(desc(conversations.lastMessageAt));

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.shopId, SHOP_ID))
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

export async function listCampaigns(): Promise<Campaign[]> {
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
    .where(eq(campaigns.shopId, SHOP_ID))
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

export async function listPayouts(): Promise<Payout[]> {
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
    .where(eq(payouts.shopId, SHOP_ID))
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
export async function openActionImpactTotal(): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ total: sum(actions.impactSatang) })
    .from(actions)
    .where(and(eq(actions.shopId, SHOP_ID), isNull(actions.resolvedAt)));
  return formatBaht(Number(row?.total ?? 0));
}
