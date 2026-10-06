/**
 * Sales, ad spend and profit computed from orders (PIN-0027).
 *
 * Until this ticket every one of these figures was a number typed into the seed. Now they are
 * aggregates over `orders`, `order_lines` and `ad_spend_daily`, so a figure on screen can be
 * traced to the rows behind it — and two figures that should agree cannot disagree.
 *
 * Three rules shape everything below:
 *
 * 1. **Windows end at the last sync, not at the wall clock.** You cannot report on orders you
 *    have not fetched. The anchor is the newest `channel_health.last_synced_at`; the screen
 *    shows it, and says which day it is when that is not today.
 * 2. **Comparisons are like-for-like.** Today up to 14:30 is compared with yesterday up to
 *    14:30, never with all of yesterday — the partial-period bug that showed −20% at 15:00.
 * 3. **Profit carries its coverage.** It is sales − cost of goods − ads, where cost of goods
 *    counts only lines whose product has a cost. The share of revenue that is costed travels
 *    with every profit figure, and anything under 100% is labelled. Fees and shipping are not
 *    known until a marketplace supplies them; the screen says so rather than guessing.
 */
import { and, eq, gte, isNull, lte, max, sql, type SQL } from "drizzle-orm";

import { getDb } from "./index";
import { adSpendDaily, channelHealth, orderLines, orders, products } from "./schema";
import type { SessionUser } from "./auth";

const DAY_MS = 24 * 60 * 60_000;
/** Thailand has no daylight saving, so a fixed offset is exact. */
const BANGKOK_OFFSET_MS = 7 * 60 * 60_000;

/** The period selector's options, and how many Bangkok days each spans. */
export const PERIODS = [
  { key: "วันนี้", days: 1 },
  { key: "7 วัน", days: 7 },
  { key: "30 วัน", days: 30 },
] as const;

export type Window = { from: number; to: number };

export type Totals = {
  orders: number;
  salesSatang: number;
  /** Cost of goods for the lines that have a cost. Never an estimate for the ones that don't. */
  cogsSatang: number;
  /** Revenue from lines whose cost is known — the numerator of coverage. */
  costedSalesSatang: number;
  adsSatang: number;
};

export type PeriodPerformance = {
  current: Totals;
  previous: Totals;
};

export type Performance = {
  /** The last successful sync, which every window ends at. The clock if nothing has synced. */
  anchor: Date;
  synced: boolean;
  periods: Record<string, PeriodPerformance>;
  /** Today's window only, per channel id — the channel table on Today. */
  channels: Map<number, Totals>;
  /** Products with no cost yet, by name, so a partial figure can say what is missing. */
  uncosted: string[];
};

const empty = (): Totals => ({ orders: 0, salesSatang: 0, cogsSatang: 0, costedSalesSatang: 0, adsSatang: 0 });

export function profitOf(totals: Totals): number {
  return totals.salesSatang - totals.cogsSatang - totals.adsSatang;
}

/** Share of revenue whose cost is known, 0–100. An empty period is fully covered: nothing is missing. */
export function coverageOf(totals: Totals): number {
  if (totals.salesSatang === 0) return 100;
  return (totals.costedSalesSatang / totals.salesSatang) * 100;
}

/** Midnight in Bangkok on the anchor's day, as a UTC instant. */
export function bangkokDayStart(instant: number): number {
  return Math.floor((instant + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
}

/** "YYYY-MM-DD" in Bangkok — the key `ad_spend_daily.day` uses. */
export function bangkokDate(instant: number): string {
  return new Date(instant + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The current window for a period, and the same span one period earlier.
 *
 * Both start at a Bangkok midnight and end at the same time of day, so a partly elapsed day
 * is compared with the same part of the day before.
 */
export function windowsFor(anchor: number, days: number): { current: Window; previous: Window } {
  const from = bangkokDayStart(anchor) - (days - 1) * DAY_MS;
  return {
    current: { from, to: anchor },
    previous: { from: from - days * DAY_MS, to: anchor - days * DAY_MS },
  };
}

/**
 * The share of one day's ad spend that falls inside a window.
 *
 * Platforms report spend per day. The anchor's own day is spend-to-date, so its row already
 * covers only midnight→anchor; every earlier day covers the whole day. Where a window takes
 * part of a day — yesterday up to the anchor's time of day — spend is assumed even across the
 * hours, which is the one estimate in this module and only touches the comparison figure.
 */
export function adShare(day: string, anchor: number, window: Window): number {
  const dayStart = Date.parse(`${day}T00:00:00+07:00`);
  const coveredTo = Math.min(dayStart + DAY_MS, anchor);
  const length = coveredTo - dayStart;
  if (length <= 0) return 0;
  const overlap = Math.min(coveredTo, window.to) - Math.max(dayStart, window.from);
  return Math.max(0, overlap) / length;
}

const iso = (instant: number) => new Date(instant).toISOString();

export async function loadPerformance(session: SessionUser): Promise<Performance> {
  const db = getDb();

  const [syncRow] = await db
    .select({ at: max(channelHealth.lastSyncedAt) })
    .from(channelHealth)
    .where(eq(channelHealth.shopId, session.shopId));
  const synced = Boolean(syncRow?.at);
  const anchor = synced ? Date.parse(syncRow!.at!) : Date.now();

  const windows = PERIODS.map((period) => ({ ...period, ...windowsFor(anchor, period.days) }));
  const earliest = Math.min(...windows.map((w) => w.previous.from));

  // One conditional sum per window, so each table is scanned once for all six windows.
  // The bounds are bound parameters, never interpolated text.
  const slots = windows.flatMap((w) => [w.current, w.previous]);
  const inSlot = (column: typeof orders.placedAt, slot: Window) =>
    sql`${column} >= ${iso(slot.from)} AND ${column} <= ${iso(slot.to)}`;

  // Every column is aliased: the six expressions differ only in their bound parameters, so
  // unaliased they share one column name, and a driver returning rows as objects keeps one.
  const orderSelect: Record<string, SQL.Aliased<number>> = {};
  const lineSelect: Record<string, SQL.Aliased<number>> = {};
  slots.forEach((slot, index) => {
    const within = inSlot(orders.placedAt, slot);
    orderSelect[`n${index}`] = sql<number>`coalesce(sum(case when ${within} then 1 else 0 end), 0)`.as(`n${index}`);
    orderSelect[`s${index}`] =
      sql<number>`coalesce(sum(case when ${within} then ${orders.totalSatang} else 0 end), 0)`.as(`s${index}`);
    lineSelect[`c${index}`] =
      sql<number>`coalesce(sum(case when ${within} then ${orderLines.quantity} * ${orderLines.unitCostSatang} else 0 end), 0)`.as(`c${index}`);
    lineSelect[`k${index}`] =
      sql<number>`coalesce(sum(case when ${within} and ${orderLines.unitCostSatang} is not null then ${orderLines.quantity} * ${orderLines.unitPriceSatang} else 0 end), 0)`.as(`k${index}`);
  });

  const range = and(
    eq(orders.shopId, session.shopId),
    gte(orders.placedAt, iso(earliest)),
    lte(orders.placedAt, iso(anchor))
  );

  const [orderRows, lineRows, adRows, uncostedRows] = await Promise.all([
    db
      .select({ channelId: orders.channelId, ...orderSelect })
      .from(orders)
      .where(range)
      .groupBy(orders.channelId),
    db
      .select({ channelId: orders.channelId, ...lineSelect })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .where(and(range, eq(orderLines.shopId, session.shopId)))
      .groupBy(orders.channelId),
    db
      .select({ channelId: adSpendDaily.channelId, day: adSpendDaily.day, spendSatang: adSpendDaily.spendSatang })
      .from(adSpendDaily)
      .where(
        and(
          eq(adSpendDaily.shopId, session.shopId),
          gte(adSpendDaily.day, bangkokDate(earliest)),
          lte(adSpendDaily.day, bangkokDate(anchor))
        )
      ),
    db
      .select({ name: products.name })
      .from(products)
      .where(and(eq(products.shopId, session.shopId), isNull(products.unitCostSatang)))
      .orderBy(products.name),
  ]);

  // slot index -> channel id -> totals
  const bySlot = slots.map(() => new Map<number, Totals>());
  const cell = (slot: number, channelId: number) => {
    const map = bySlot[slot];
    if (!map.has(channelId)) map.set(channelId, empty());
    return map.get(channelId)!;
  };

  for (const row of orderRows as Record<string, number>[]) {
    slots.forEach((_, index) => {
      const totals = cell(index, row.channelId);
      totals.orders += Number(row[`n${index}`]);
      totals.salesSatang += Number(row[`s${index}`]);
    });
  }
  for (const row of lineRows as Record<string, number>[]) {
    slots.forEach((_, index) => {
      const totals = cell(index, row.channelId);
      totals.cogsSatang += Number(row[`c${index}`]);
      totals.costedSalesSatang += Number(row[`k${index}`]);
    });
  }
  for (const ad of adRows) {
    slots.forEach((slot, index) => {
      const share = adShare(ad.day, anchor, slot);
      if (share > 0) cell(index, ad.channelId).adsSatang += Math.round(ad.spendSatang * share);
    });
  }

  const sumOf = (map: Map<number, Totals>): Totals => {
    const total = empty();
    for (const totals of map.values()) {
      total.orders += totals.orders;
      total.salesSatang += totals.salesSatang;
      total.cogsSatang += totals.cogsSatang;
      total.costedSalesSatang += totals.costedSalesSatang;
      total.adsSatang += totals.adsSatang;
    }
    return total;
  };

  const periods: Record<string, PeriodPerformance> = {};
  windows.forEach((window, index) => {
    periods[window.key] = { current: sumOf(bySlot[index * 2]), previous: sumOf(bySlot[index * 2 + 1]) };
  });

  return {
    anchor: new Date(anchor),
    synced,
    periods,
    channels: bySlot[0],
    uncosted: uncostedRows.map((row) => row.name),
  };
}
