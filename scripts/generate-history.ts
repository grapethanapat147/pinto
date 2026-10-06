/**
 * Sixty days of order history for the demo shop (PIN-0027).
 *
 * เกรพ chose option ก in `.codex/specs/cost-and-profit.md`: keep the demo looking like the busy
 * shop it always claimed to be, but make every figure on screen *computed* from orders rather
 * than typed into a fixture. That needs orders at the scale the old tiles described — and the
 * six hand-made orders in `app/fixtures/orders.ts` stay as the newest, because conversations
 * and the Orders view refer to them by id.
 *
 * **Deterministic.** A seeded PRNG, so every seed run produces the same shape: tests can
 * assert on it and two people looking at the demo see the same shop. Dates are relative to
 * the run, like everything else in the seed, so the demo never ages.
 *
 * Sixty days rather than thirty because the 30-day tile compares against the thirty before
 * it. A window with nothing before it cannot have a "change".
 */

/** mulberry32 — small, fast, and good enough for believable noise. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Weighted<T> = readonly (readonly [T, number])[];

function pick<T>(random: () => number, options: Weighted<T>): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return options[options.length - 1][0];
}

export type GeneratedOrder = {
  externalId: string;
  channel: "tiktok" | "shopee" | "line";
  customer: string;
  /** Days before the seed run: 0 is today. */
  dayOffset: number;
  /** Minutes after local midnight. */
  minute: number;
  status: string;
  lines: { sku: string; quantity: number }[];
};

export type GeneratedAdDay = { dayOffset: number; channel: "tiktok" | "shopee"; spendBaht: number };

const CHANNELS: Weighted<GeneratedOrder["channel"]> = [
  ["tiktok", 50],
  ["shopee", 34],
  ["line", 16],
];

/** Tray and vase are the everyday sellers; the lamp is the considered purchase. */
const PRODUCTS: Weighted<string> = [
  ["ML-TR-031", 38],
  ["ML-CV-018", 26],
  ["ML-LN-012", 20],
  ["ML-AG-024", 12],
  ["ML-CL-006", 4],
];

const ITEMS_PER_ORDER: Weighted<number> = [[1, 88], [2, 11], [3, 1]];
const QUANTITY: Weighted<number> = [[1, 94], [2, 5], [3, 1]];

const FIRST_NAMES = [
  "ปิยะดา", "ธนพล", "อรุณี", "กิตติ", "สุภาพร", "วรเชษฐ์", "นภัสสร", "ชยพล",
  "พิมพ์ชนก", "ณัฐวุฒิ", "กมลชนก", "ภูริ", "ศศิธร", "อนุชา", "มณีรัตน์", "ธีรภัทร",
  "จิราพร", "ปกรณ์", "รัชนี", "สิทธิชัย", "เบญจมาศ", "วีระพงษ์", "ลลิตา", "ศุภกร",
];
const LAST_INITIALS = ["ก.", "ข.", "จ.", "ช.", "ด.", "ท.", "น.", "พ.", "ม.", "ร.", "ว.", "ส."];

/**
 * Orders per day. Roughly 220 a day thirty to sixty days ago rising to about 255 recently —
 * the ~16% month-on-month growth the old tile claimed — with weekends busier and early
 * weeks quieter, plus noise so no two days match.
 */
function ordersForDay(dayOffset: number, weekday: number, random: () => number): number {
  const progress = (59 - dayOffset) / 59; // 0 sixty days ago, 1 today
  // Steep enough that the last thirty days run ~16% above the thirty before — the growth
  // the old tile claimed. A gentler slope measured only +6.7%.
  const trend = 196 + progress * 88;
  const weekdayFactor = [1.12, 0.9, 0.92, 0.97, 1.0, 1.08, 1.16][weekday]; // Sun..Sat
  const noise = 0.92 + random() * 0.16;
  return Math.round(trend * weekdayFactor * noise);
}

/** Generated orders fall between midnight and 23:30 on each day. */
const DAY_SPREAD_MINUTES = 23 * 60 + 30;

export function generateHistory({
  seedAt,
  minutesNow,
  reservedToday,
}: {
  seedAt: Date;
  /** Minutes after midnight, Bangkok, at seed time — today's orders must not be in the future. */
  minutesNow: number;
  /** Today's hand-made orders, so the generated ones fill around them instead of on top. */
  reservedToday: number;
}): { orders: GeneratedOrder[] } {
  const random = prng(20260930);
  const orders: GeneratedOrder[] = [];

  // External ids count down into the past so the newest hand-made ids (TT-10842,
  // SP-48219, LN-39204) stay the highest and nothing collides with them.
  const nextId = { tiktok: 10839, shopee: 48217, line: 39203 };
  const prefix = { tiktok: "TT", shopee: "SP", line: "LN" } as const;

  for (let dayOffset = 0; dayOffset <= 59; dayOffset += 1) {
    // Shifted to +07:00 first, so the weekday is Bangkok's rather than UTC's.
    const day = new Date(seedAt.getTime() + 7 * 60 * 60_000);
    day.setUTCDate(day.getUTCDate() - dayOffset);
    const weekday = day.getUTCDay();

    let count = ordersForDay(dayOffset, weekday, random);
    // Today is only part-way through: scale to the minutes that have passed, and leave room
    // for the hand-made orders that are already today's newest. The scale must use the same
    // spread as every other day (below, 00:00–23:30) — scaling against a 20-hour day once made
    // "today so far" beat "yesterday at the same time" by 17% on every seed, by construction.
    const latest = dayOffset === 0 ? Math.max(1, minutesNow - 30) : DAY_SPREAD_MINUTES;
    if (dayOffset === 0) {
      count = Math.max(0, Math.round(count * Math.min(1, latest / DAY_SPREAD_MINUTES)) - reservedToday);
    }

    for (let i = 0; i < count; i += 1) {
      const channel = pick(random, CHANNELS);
      const itemCount = pick(random, ITEMS_PER_ORDER);
      const skus = new Set<string>();
      while (skus.size < itemCount) skus.add(pick(random, PRODUCTS));
      const lines = [...skus].map((sku) => ({ sku, quantity: pick(random, QUANTITY) }));

      const minute = Math.floor(random() * latest);

      const status =
        dayOffset >= 3
          ? "จัดส่งแล้ว"
          : dayOffset >= 1
            ? pick(random, [["จัดส่งแล้ว", 70], ["พร้อมส่ง", 25], ["ตรวจสอบ", 5]] as const)
            : pick(random, [["รอแพ็ก", 45], ["พร้อมส่ง", 25], ["ชำระแล้ว", 22], ["ตรวจสอบ", 8]] as const);

      const id = nextId[channel]--;
      orders.push({
        externalId: `${prefix[channel]}-${id}`,
        channel,
        customer: `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${LAST_INITIALS[Math.floor(random() * LAST_INITIALS.length)]}`,
        dayOffset,
        minute,
        status,
        lines,
      });
    }
  }

  return { orders };
}

/**
 * Daily ad spend, set from each day's real sales once they are priced: 17–21% of the day's
 * TikTok and Shopee revenue, which lands near 16% of all sales. LINE MyShop is a chat
 * storefront with no paid placement here, so it carries no ad spend.
 */
export function adSpendFor(
  salesByDayAndChannel: Map<string, number>,
  dayOffsets: number[],
): GeneratedAdDay[] {
  const random = prng(19700101);
  const out: GeneratedAdDay[] = [];
  for (const dayOffset of dayOffsets) {
    for (const channel of ["tiktok", "shopee"] as const) {
      const sales = salesByDayAndChannel.get(`${dayOffset}:${channel}`) ?? 0;
      if (sales === 0) continue;
      const ratio = 0.17 + random() * 0.04; // of the channel's own sales, which skews total ~14.5%
      out.push({ dayOffset, channel, spendBaht: Math.round(sales * ratio) });
    }
  }
  return out;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60_000; // Thailand has no daylight saving
const DAY_MS = 24 * 60 * 60_000;

export type PricedOrder = Omit<GeneratedOrder, "lines"> & {
  totalSatang: number;
  /** ISO-8601 UTC, on the Bangkok clock relative to the anchor. */
  placedAt: string;
  lines: { sku: string; quantity: number; unitPriceSatang: number; unitCostSatang: number | null }[];
};

export type PricedAdDay = { channel: "tiktok" | "shopee"; /** Bangkok YYYY-MM-DD */ day: string; spendSatang: number };

/**
 * The generated history, priced and dated: what both the seed and the production backfill
 * (PIN-0029) write. One function so the two cannot drift apart.
 *
 * `anchor` is the moment the history runs up to — the seed's own run time locally, and the
 * last sync time when backfilling a database that already has its hand-made orders. Day 0 is
 * the anchor's Bangkok day, and today's orders stop 30 minutes before the anchor.
 */
export function pricedHistory({
  anchor,
  reservedToday,
  prices,
}: {
  anchor: Date;
  reservedToday: number;
  /** Baht, keyed by SKU — `productCosts` from `app/fixtures/order-lines.ts`. */
  prices: Record<string, { price: number; cost: number | null }>;
}): { orders: PricedOrder[]; adDays: PricedAdDay[] } {
  const midnight =
    Math.floor((anchor.getTime() + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
  const minutesNow = Math.floor((anchor.getTime() - midnight) / 60_000);
  const satang = (baht: number) => Math.round(baht * 100);

  const { orders: history } = generateHistory({ seedAt: anchor, minutesNow, reservedToday });
  const salesByDayAndChannel = new Map<string, number>();

  const orders = history.map((order) => {
    const lines = order.lines.map((line) => {
      const entry = prices[line.sku];
      if (!entry) throw new Error(`No price/cost fixture for ${line.sku} — add it to order-lines.ts.`);
      return {
        ...line,
        unitPriceSatang: satang(entry.price),
        unitCostSatang: entry.cost === null ? null : satang(entry.cost),
      };
    });
    const totalSatang = lines.reduce((sum, line) => sum + line.unitPriceSatang * line.quantity, 0);
    const key = `${order.dayOffset}:${order.channel}`;
    salesByDayAndChannel.set(key, (salesByDayAndChannel.get(key) ?? 0) + totalSatang / 100);
    return {
      ...order,
      lines,
      totalSatang,
      placedAt: new Date(midnight - order.dayOffset * DAY_MS + order.minute * 60_000).toISOString(),
    };
  });

  const dayOffsets = [...new Set(history.map((order) => order.dayOffset))];
  const adDays = adSpendFor(salesByDayAndChannel, dayOffsets).map((ad) => ({
    channel: ad.channel,
    day: new Date(midnight + BANGKOK_OFFSET_MS - ad.dayOffset * DAY_MS).toISOString().slice(0, 10),
    spendSatang: satang(ad.spendBaht),
  }));

  return { orders, adDays };
}
