/**
 * Channel identity and adapters (PIN-0015). See `.codex/specs/channel-adapters.md`.
 *
 * Before this, three places in `queries.ts` each re-derived a channel's short name with
 * the same ternary, whose `: "TikTok"` fallback meant an unrecognised channel rendered as
 * TikTok with nothing failing. Components then recovered the logo class by sniffing the
 * display text. Both are now one lookup over data.
 *
 * The adapter interface is deliberately narrow. An interface with no real implementation
 * is designed against guesses, so it covers only what the app already does with a channel;
 * a real TikTok Shop integration will change it, and that is expected.
 */
import { eq } from "drizzle-orm";

import { getDb } from "./index";
import type { SessionUser } from "./auth";
import { channelHealth, channels } from "./schema";

export type ChannelIdentity = {
  id: number;
  code: string;
  /** "TikTok Shop" — used in headings and the sync grid. */
  displayName: string;
  /** "TikTok" — used in tables and chat headers. */
  shortName: string;
  /** Logo class; stored rather than inferred from the name. */
  accent: string;
  kind: "marketplace" | "ads" | "chat";
};

export type ChannelHealthState = "healthy" | "syncing" | "degraded" | "disconnected";

export type ChannelHealthReport = {
  channel: ChannelIdentity;
  state: ChannelHealthState;
  detail: string | null;
  lastSyncedAt: string | null;
};

/**
 * What Pinto needs from a channel today — nothing more.
 *
 * Only `health()` so far, because that is the only channel operation the app actually
 * performs. The spec sketched `listOrders`/`sendMessage` too, but adding methods no
 * implementation calls is exactly the guesswork it warned against; they arrive with the
 * first real integration, which is also when their real shape becomes known.
 */
export type ChannelAdapter = {
  readonly channel: ChannelIdentity;
  health(): Promise<ChannelHealthReport>;
};

/** Every channel for a shop, keyed by code. Built once per request. */
export async function loadChannels(session: SessionUser): Promise<Map<string, ChannelIdentity>> {
  const rows = await getDb()
    .select()
    .from(channels)
    .where(eq(channels.shopId, session.shopId));

  return new Map(
    rows.map((row) => [
      row.code,
      {
        id: row.id,
        code: row.code,
        displayName: row.displayName,
        shortName: row.shortName || row.displayName,
        accent: row.accent,
        kind: row.kind,
      },
    ])
  );
}

/**
 * Throws on an unknown code rather than falling back.
 *
 * The old ternary's silent default is exactly the failure this replaces: adding a fourth
 * marketplace would have mislabelled its orders as TikTok with nothing to notice.
 */
export function requireChannel(
  known: Map<string, ChannelIdentity>,
  code: string
): ChannelIdentity {
  const channel = known.get(code);
  if (!channel) {
    throw new Error(
      `Unknown channel code ${JSON.stringify(code)}. Add it to the channels table rather ` +
        `than letting it fall back to another channel's identity.`
    );
  }
  return channel;
}

/**
 * The only adapter that exists. It reads seeded state instead of calling a marketplace,
 * which is what makes the interface load-bearing rather than aspirational — a real
 * provider plugs into this same seam.
 */
export function createDemoAdapter(
  channel: ChannelIdentity,
  report: Omit<ChannelHealthReport, "channel"> | undefined
): ChannelAdapter {
  return {
    channel,
    async health() {
      // No row at all means the channel was never connected. A row with a null `detail`
      // is a healthy channel with nothing particular to report — those are different
      // things, and conflating them printed "not connected" under a healthy channel.
      if (!report) {
        return {
          channel,
          state: "disconnected" as const,
          detail: "ยังไม่ได้เชื่อมต่อช่องทางนี้",
          lastSyncedAt: null,
        };
      }
      return { channel, ...report };
    },
  };
}

/** Health for every marketplace/chat channel — what the sync grid renders. */
export async function listChannelHealth(session: SessionUser): Promise<ChannelHealthReport[]> {
  const db = getDb();
  const rows = await db
    .select({
      code: channels.code,
      displayName: channels.displayName,
      shortName: channels.shortName,
      accent: channels.accent,
      kind: channels.kind,
      id: channels.id,
      state: channelHealth.state,
      detail: channelHealth.detail,
      lastSyncedAt: channelHealth.lastSyncedAt,
    })
    .from(channels)
    .leftJoin(channelHealth, eq(channelHealth.channelId, channels.id))
    .where(eq(channels.shopId, session.shopId));

  const adapters = rows
    // ad platforms have no stock to sync, so they are not part of this grid
    .filter((row) => row.kind !== "ads")
    .map((row) =>
      createDemoAdapter(
        {
          id: row.id,
          code: row.code,
          displayName: row.displayName,
          shortName: row.shortName || row.displayName,
          accent: row.accent,
          kind: row.kind,
        },
        row.state ? { state: row.state, detail: row.detail, lastSyncedAt: row.lastSyncedAt } : undefined
      )
    );

  return Promise.all(adapters.map((adapter) => adapter.health()));
}
