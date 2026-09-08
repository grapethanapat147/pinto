/**
 * Read layer. Maps Drizzle rows onto the shapes in `app/types.ts` so views keep their
 * current props and stay unaware of where the data came from (spec D3).
 *
 * Derived values are computed here rather than stored (schema-v1 F2).
 */
import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "./index";
import { channels, inventoryLevels, orders, products } from "./schema";
import { formatBaht, formatTime } from "../app/format";
import type { InventoryItem, Order } from "../app/types";

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
