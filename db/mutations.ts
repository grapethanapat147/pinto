/**
 * Write layer (spec D4). Every write is scoped by `shop_id` so milestone 4's
 * authentication has a column to filter on rather than a rewrite to do.
 *
 * Each function reports whether it actually changed anything, so a route can answer 404
 * for an unknown id instead of a misleading 200 — the PIN-0001 rule applied to the
 * backend: never report success for work that did not happen.
 */
import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "./index";
import { actionSnoozes, conversations, messages, orderLines, products } from "./schema";

import type { SessionUser } from "./auth";

/**
 * "ซ่อนถึงพรุ่งนี้" on a daily-brief card (PIN-0031): hides that card for this shop until
 * `until`. Snoozing again moves the time; it never hides another shop's card.
 */
export async function snoozeCard(session: SessionUser, cardKey: string, until: string): Promise<void> {
  await getDb()
    .insert(actionSnoozes)
    .values({ shopId: session.shopId, cardKey, until })
    .onConflictDoUpdate({ target: [actionSnoozes.shopId, actionSnoozes.cardKey], set: { until } });
}

/** Returns false when the conversation does not exist or belongs to another shop. */
export async function addShopMessage(session: SessionUser, conversationId: number, body: string): Promise<boolean> {
  const db = getDb();
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.shopId, session.shopId)));

  if (!conversation) return false;

  const sentAt = new Date().toISOString();
  await db.insert(messages).values({
    shopId: session.shopId,
    conversationId,
    sender: "shop",
    body,
    sentAt,
  });
  // the inbox orders threads by recency, so this has to move too
  await db.update(conversations).set({ lastMessageAt: sentAt }).where(eq(conversations.id, conversationId));

  return true;
}

/**
 * Sets a product's cost per unit (PIN-0028). Future order lines snapshot it; existing lines
 * keep the cost they were recorded with — that is what a snapshot is for.
 *
 * `fillPast` is the one exception (spec Q8): when a product gets its **first** cost, the past
 * lines that had none may take it. Filling a gap is not rewriting history; changing a cost
 * that was already there would be, so it is refused once the product has one.
 *
 * Lines are filled before the product is updated, and only while the product is still
 * uncosted. If the second write never happens, retrying finds nothing left to fill and sets
 * the product — no line is ever written twice, and none is left half-filled.
 */
export async function setProductCost(
  session: SessionUser,
  sku: string,
  unitCostSatang: number,
  fillPast: boolean
): Promise<{ status: "ok"; filled: number } | { status: "not_found" } | { status: "already_costed" }> {
  const db = getDb();
  const [product] = await db
    .select({ id: products.id, unitCostSatang: products.unitCostSatang })
    .from(products)
    .where(and(eq(products.shopId, session.shopId), eq(products.sku, sku)));
  if (!product) return { status: "not_found" };
  if (fillPast && product.unitCostSatang !== null) return { status: "already_costed" };

  let filled = 0;
  if (fillPast) {
    const updated = await db
      .update(orderLines)
      .set({ unitCostSatang })
      .where(
        and(
          eq(orderLines.shopId, session.shopId),
          eq(orderLines.productId, product.id),
          isNull(orderLines.unitCostSatang),
          sql`(SELECT ${products.unitCostSatang} FROM ${products} WHERE ${products.id} = ${product.id}) IS NULL`
        )
      )
      .returning({ id: orderLines.id });
    filled = updated.length;
  }

  await db
    .update(products)
    .set({ unitCostSatang })
    .where(and(eq(products.id, product.id), eq(products.shopId, session.shopId)));
  return { status: "ok", filled };
}
