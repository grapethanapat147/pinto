/**
 * Write layer (spec D4). Every write is scoped by `shop_id` so milestone 4's
 * authentication has a column to filter on rather than a rewrite to do.
 *
 * Each function reports whether it actually changed anything, so a route can answer 404
 * for an unknown id instead of a misleading 200 — the PIN-0001 rule applied to the
 * backend: never report success for work that did not happen.
 */
import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { actionSnoozes, conversations, messages } from "./schema";

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
