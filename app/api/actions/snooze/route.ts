import { nextBangkokMidnight, parseCardKey, RULES } from "../../../../db/brief";
import { snoozeCard } from "../../../../db/mutations";
import { getSession } from "../../../session";

/**
 * "ซ่อนถึงพรุ่งนี้" on a daily-brief card (PIN-0031). Replaces the resolve route: a computed
 * card cannot be marked done — it clears when the data does — so the only write is a snooze.
 */
export async function POST(request: Request) {
  // the session decides which shop is written to, so it comes before anything else
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const card = parseCardKey((body as { key?: unknown } | null)?.key);
  if (!card) {
    return Response.json({ error: "unknown card key" }, { status: 400 });
  }
  // a card staff never receive is not theirs to hide either
  if (RULES[card.rule].ownerOnly && session.role !== "owner") {
    return Response.json({ error: "not allowed" }, { status: 403 });
  }

  const until = nextBangkokMidnight(Date.now());
  try {
    await snoozeCard(session, card.key, until);
    return Response.json({ snoozed: true, until });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "unexpected error" },
      { status: 500 }
    );
  }
}
