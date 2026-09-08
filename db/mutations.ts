/**
 * Write layer (spec D4). Every write is scoped by `shop_id` so milestone 4's
 * authentication has a column to filter on rather than a rewrite to do.
 *
 * Each function reports whether it actually changed anything, so a route can answer 404
 * for an unknown id instead of a misleading 200 — the PIN-0001 rule applied to the
 * backend: never report success for work that did not happen.
 */
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "./index";
import { actions, conversations, messages } from "./schema";

const SHOP_ID = 1;

/** Returns false when the action does not exist, belongs elsewhere, or is already done. */
export async function resolveAction(actionId: number): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(actions)
    .set({ resolvedAt: new Date().toISOString() })
    .where(and(eq(actions.id, actionId), eq(actions.shopId, SHOP_ID), isNull(actions.resolvedAt)))
    .returning({ id: actions.id });

  return updated.length > 0;
}

/** Returns false when the conversation does not exist or belongs to another shop. */
export async function addShopMessage(conversationId: number, body: string): Promise<boolean> {
  const db = getDb();
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.shopId, SHOP_ID)));

  if (!conversation) return false;

  const sentAt = new Date().toISOString();
  await db.insert(messages).values({
    shopId: SHOP_ID,
    conversationId,
    sender: "shop",
    body,
    sentAt,
  });
  // the inbox orders threads by recency, so this has to move too
  await db.update(conversations).set({ lastMessageAt: sentAt }).where(eq(conversations.id, conversationId));

  return true;
}
