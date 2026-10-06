/**
 * Emits the domain seed as SQL on stdout. Run via `npm run db:local:seed`.
 *
 * The fixtures under `app/fixtures/` are the source of truth (spec D2) — they are
 * imported here, never copied. Node 24 strips the types natively, which is why this is a
 * .ts file with no build step and no extra dependency.
 *
 * Two conversions matter:
 * - money: display strings like "฿1,890" become integer satang (189000)
 * - time: display strings are anchored to the seed run (spec Q2), preserving their
 *   relative offsets, so the demo always reads as "today" instead of ageing
 */
import { actionItems } from "../app/fixtures/actions.ts";
import { campaigns } from "../app/fixtures/campaigns.ts";
import { conversations } from "../app/fixtures/conversations.ts";
import { inventory } from "../app/fixtures/inventory.ts";
import { orderLines, productCosts } from "../app/fixtures/order-lines.ts";
import { adSpendFor, generateHistory } from "./generate-history.ts";
import { orders } from "../app/fixtures/orders.ts";
import { payouts } from "../app/fixtures/payouts.ts";
import {
  channelPerformance, customerSegments, periodMetrics, productOpportunities,
  recommendationPanels, regionShares, restockSuggestions, viewTiles, waterfallSteps,
} from "../app/fixtures/metrics.ts";

const SHOP = "ร้าน Mali Living";

/* ---------- conversions ---------- */

/** Baht as a number -> integer satang. Declared first: the products and order-line inserts
 *  call it at module load, and a `const` read before its declaration throws. */
const money = (baht: number) => Math.round(baht * 100);

/** "฿1,890" | "เสี่ยงเสีย ฿3,240" -> satang. Throws rather than guessing. */
function satang(display: string): number {
  const match = display.match(/฿\s*([\d,]+(?:\.\d+)?)/);
  if (!match) throw new Error(`no baht amount in ${JSON.stringify(display)}`);
  return Math.round(Number(match[1].replace(/,/g, "")) * 100);
}

/** The label before the amount: "เสี่ยงเสีย ฿3,240" -> "เสี่ยงเสีย". */
function impactKind(display: string): string {
  return display.slice(0, display.indexOf("฿")).trim();
}

const SEED_AT = new Date();
const minutesAgo = (n: number) => new Date(SEED_AT.getTime() - n * 60_000).toISOString();

/**
 * Every date the seed writes is on the Bangkok clock, explicitly.
 *
 * These used `setHours` and `toISOString().slice(0, 10)`, i.e. the machine's zone for times
 * and UTC for dates. On a machine set to Bangkok, before 07:00 those two disagree about which
 * day it is — harmless while the figures were constants, wrong once ad spend is keyed by
 * day and joined to orders by day (PIN-0027). Thailand has no daylight saving, so a fixed
 * +07:00 is exact.
 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const BANGKOK_MIDNIGHT = Math.floor((SEED_AT.getTime() + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
/** Minutes since Bangkok midnight at the moment the seed runs. */
const MINUTES_INTO_DAY = Math.floor((SEED_AT.getTime() - BANGKOK_MIDNIGHT) / 60_000);

/** Day 0 is the seed date; `hhmm` is a Bangkok wall-clock time on that day. */
function at(hhmm: string, dayOffset = 0): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(BANGKOK_MIDNIGHT + dayOffset * DAY_MS + (h * 60 + m) * 60_000).toISOString();
}

/** The Bangkok calendar date, `dayOffset` days from the seed date. */
function dateOnly(dayOffset: number): string {
  return new Date(BANGKOK_MIDNIGHT + BANGKOK_OFFSET_MS + dayOffset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The hand-made orders keep their spacing but end just before the seed runs.
 *
 * Their fixture times (09:33–10:36) were written beside an "อัปเดตล่าสุด 10:42" label. Pinned
 * to those clock times, seeding at 08:00 put them in the future — after the last sync, so
 * outside every reporting window — while the generated history stopped short of them.
 */
function beforeSeed(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return minutesAgo(10 * 60 + 42 - (h * 60 + m));
}

/** "อัปเดต 10:38 น." -> "10:38" */
function timeIn(text: string): string {
  const match = text.match(/(\d{1,2}:\d{2})/);
  if (!match) throw new Error(`no time in ${JSON.stringify(text)}`);
  return match[1];
}

/**
 * Message stamps are either a clock time or a relative word. Only the words actually
 * present in the fixtures are handled — anything else throws rather than silently
 * seeding "now".
 */
function messageTime(stamp: string): string {
  if (/^\d{1,2}:\d{2}$/.test(stamp)) return at(stamp);
  if (stamp === "เมื่อวาน") return at("15:20", -1);
  throw new Error(`unhandled message stamp ${JSON.stringify(stamp)}`);
}

/* ---------- channels ---------- */

/**
 * The fixtures spell channels four ways. This is the canonical list; `resolve` maps every
 * spelling that appears in the data onto it, and throws on anything unmapped so a new
 * spelling cannot slip through as a silent miss.
 */
const CHANNELS = [
  { code: "tiktok", displayName: "TikTok Shop", shortName: "TikTok", accent: "tiktok", kind: "marketplace" },
  { code: "shopee", displayName: "Shopee", shortName: "Shopee", accent: "shopee", kind: "marketplace" },
  { code: "line", displayName: "LINE MyShop", shortName: "LINE", accent: "line", kind: "chat" },
  { code: "tiktok_ads", displayName: "TikTok Ads", shortName: "TikTok", accent: "tiktok", kind: "ads" },
  { code: "meta_ads", displayName: "Meta", shortName: "Meta", accent: "meta", kind: "ads" },
] as const;

const CHANNEL_ALIASES: Record<string, string> = {
  TikTok: "tiktok",
  "TikTok Shop": "tiktok",
  Shopee: "shopee",
  LINE: "line",
  "LINE MyShop": "line",
  "TikTok Ads": "tiktok_ads",
  Meta: "meta_ads",
};

function channelId(spelling: string): number {
  const code = CHANNEL_ALIASES[spelling];
  if (!code) throw new Error(`unmapped channel ${JSON.stringify(spelling)}`);
  return CHANNELS.findIndex((c) => c.code === code) + 1;
}

/* ---------- SQL emitter ---------- */

const q = (v: string | number | null) =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;

const out: string[] = [];
const insert = (table: string, cols: string[], rows: (string | number | null)[][]) => {
  if (!rows.length) return;
  out.push(
    `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES\n` +
      rows.map((r) => `  (${r.map(q).join(", ")})`).join(",\n") +
      ";"
  );
};

// Idempotent: wipe in FK-safe order, then reinsert. Only ever touches seeded tables.
out.push("PRAGMA defer_foreign_keys = ON;");
for (const t of [
  "messages", "conversations", "order_lines", "orders", "ad_spend_daily", "inventory_levels", "products",
  "actions", "campaigns", "payouts",
  // presentation scaffolding (schema-v1 Q1c)
  "dashboard_metrics", "channel_metrics", "customer_segments", "regions",
  "waterfall_steps", "restock_suggestions", "product_opportunities", "recommendations",
  "sessions", "users", "channel_health", "inventory_channel_sync",
  "channels", "shops",
]) {
  out.push(`DELETE FROM \`${t}\`;`);
}

insert("shops", ["id", "name", "created_at"], [[1, SHOP, SEED_AT.toISOString()]]);

insert(
  "channels",
  ["id", "shop_id", "code", "display_name", "short_name", "accent", "kind"],
  CHANNELS.map((c, i) => [i + 1, 1, c.code, c.displayName, c.shortName, c.accent, c.kind])
);

const costOf = (sku: string) => {
  const entry = productCosts[sku];
  if (!entry) throw new Error(`No price/cost fixture for ${sku} — add it to order-lines.ts.`);
  return entry;
};

insert(
  "products",
  ["id", "shop_id", "sku", "name", "category", "unit_cost_satang"],
  inventory.map((item, i) => {
    const { cost } = costOf(item.sku);
    return [i + 1, 1, item.sku, item.name, item.category, cost === null ? null : money(cost)];
  })
);

insert(
  "inventory_levels",
  ["id", "shop_id", "product_id", "on_hand", "reserved", "days_left", "sync_state", "updated_at"],
  inventory.map((item, i) => [
    i + 1, 1, i + 1, item.stock, item.reserved, item.daysLeft, item.sync, SEED_AT.toISOString(),
  ])
);

insert(
  "orders",
  ["id", "shop_id", "channel_id", "external_id", "customer_name", "total_satang", "status", "placed_at"],
  orders.map((o, i) => [
    i + 1, 1, channelId(o.channel), o.id, o.customer, satang(o.total), o.status, beforeSeed(o.time),
  ])
);

const orderIdByExternal = new Map(orders.map((o, i) => [o.id, i + 1]));
const productIdBySkuForLines = new Map(inventory.map((item, i) => [item.sku, i + 1]));

// Order lines (PIN-0026). The cost column is a snapshot of the product's cost at seed time —
// the same copy a real order takes when it is recorded. Lines must sum to the order's
// existing total; a mismatch means the fixture and the order disagree, so it stops the seed.
{
  const rows: (string | number | null)[][] = [];
  let lineId = 1;
  for (const order of orders) {
    const lines = orderLines[order.id];
    if (!lines) throw new Error(`Order ${order.id} has no lines in order-lines.ts.`);
    let sum = 0;
    for (const line of lines) {
      const { price, cost } = costOf(line.sku);
      const productId = productIdBySkuForLines.get(line.sku);
      if (!productId) throw new Error(`Order ${order.id} references unknown SKU ${line.sku}.`);
      sum += money(price) * line.quantity;
      rows.push([
        lineId++, 1, orderIdByExternal.get(order.id)!, productId, line.quantity,
        money(price), cost === null ? null : money(cost),
      ]);
    }
    if (sum !== satang(order.total)) {
      throw new Error(`Order ${order.id}: lines sum to ${sum} satang but the order total is ${satang(order.total)}.`);
    }
  }
  insert(
    "order_lines",
    ["id", "shop_id", "order_id", "product_id", "quantity", "unit_price_satang", "unit_cost_satang"],
    rows
  );
}

// Sixty days of generated history (PIN-0027), around the six hand-made orders above. See
// `scripts/generate-history.ts` for why, and why it is deterministic.
{
  const { orders: history } = generateHistory({
    seedAt: SEED_AT,
    minutesNow: MINUTES_INTO_DAY,
    reservedToday: orders.length,
  });

  const hhmm = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const channelIdByCode: Record<string, number> = {
    tiktok: channelId("TikTok Shop"),
    shopee: channelId("Shopee"),
    line: channelId("LINE MyShop"),
  };

  const orderRows: (string | number | null)[][] = [];
  const lineRows: (string | number | null)[][] = [];
  const salesByDayAndChannel = new Map<string, number>();
  let orderId = orders.length + 1;
  let lineId = 1_000_000; // well clear of the hand-made lines

  for (const order of history) {
    let total = 0;
    for (const line of order.lines) {
      const { price, cost } = costOf(line.sku);
      total += money(price) * line.quantity;
      lineRows.push([
        lineId++, 1, orderId, productIdBySkuForLines.get(line.sku)!, line.quantity,
        money(price), cost === null ? null : money(cost),
      ]);
    }
    // `at` is the same clock the hand-made orders use, so "today" means one thing.
    orderRows.push([
      orderId++, 1, channelIdByCode[order.channel], order.externalId, order.customer,
      total, order.status, at(hhmm(order.minute), -order.dayOffset),
    ]);
    const key = `${order.dayOffset}:${order.channel}`;
    salesByDayAndChannel.set(key, (salesByDayAndChannel.get(key) ?? 0) + total / 100);
  }

  // Thousands of rows: chunk the INSERTs so no single statement is unreasonably large.
  const CHUNK = 500;
  for (let i = 0; i < orderRows.length; i += CHUNK) {
    insert(
      "orders",
      ["id", "shop_id", "channel_id", "external_id", "customer_name", "total_satang", "status", "placed_at"],
      orderRows.slice(i, i + CHUNK)
    );
  }
  for (let i = 0; i < lineRows.length; i += CHUNK) {
    insert(
      "order_lines",
      ["id", "shop_id", "order_id", "product_id", "quantity", "unit_price_satang", "unit_cost_satang"],
      lineRows.slice(i, i + CHUNK)
    );
  }

  // Ad spend per day per channel, from each day's priced sales.
  const dayOffsets = [...new Set(history.map((order) => order.dayOffset))];
  const adDays = adSpendFor(salesByDayAndChannel, dayOffsets);
  insert(
    "ad_spend_daily",
    ["id", "shop_id", "channel_id", "day", "spend_satang"],
    adDays.map((ad, i) => [
      i + 1, 1, channelIdByCode[ad.channel], dateOnly(-ad.dayOffset), money(ad.spendBaht),
    ])
  );
}

insert(
  "conversations",
  ["id", "shop_id", "channel_id", "order_id", "customer_name", "topic", "preview", "unread_count", "last_message_at"],
  conversations.map((c) => [
    c.id, 1, channelId(c.channel), orderIdByExternal.get(c.order) ?? null,
    c.name, c.topic, c.preview, c.unread, at(c.time),
  ])
);

let messageId = 0;
insert(
  "messages",
  ["id", "shop_id", "conversation_id", "sender", "body", "sent_at"],
  conversations.flatMap((c) =>
    c.messages.map((m) => [++messageId, 1, c.id, m.from, m.text, messageTime(m.time)])
  )
);

insert(
  "actions",
  [
    "id", "shop_id", "channel_label", "tone", "label", "title", "detail",
    "impact_kind", "impact_satang", "insight", "recommendation", "detected_at", "resolved_at",
  ],
  actionItems.map((a) => [
    a.id, 1, a.channel, a.tone, a.label, a.title, a.detail,
    impactKind(a.impact), satang(a.impact), a.insight, a.recommendation,
    at(timeIn(a.source)), null,
  ])
);

insert(
  "campaigns",
  ["id", "shop_id", "channel_id", "name", "spend_satang", "revenue_satang", "health"],
  campaigns.map((c, i) => [
    i + 1, 1,
    // campaign channels are ad platforms; "TikTok" here means TikTok Ads
    channelId(c.channel === "TikTok" ? "TikTok Ads" : c.channel),
    c.name, satang(c.spend), satang(c.revenue), c.health,
  ])
);

insert(
  "payouts",
  ["id", "shop_id", "channel_id", "expected_on", "order_count", "amount_satang", "status"],
  // fixture dates are consecutive days after the selected day; keep them 1/2/3 days out
  payouts.map((p, i) => [
    i + 1, 1, channelId(p.platform), dateOnly(i + 1),
    Number(p.orders.replace(/\D/g, "")), satang(p.amount), p.status,
  ])
);

/* ---------- presentation scaffolding ---------- */

const productIdBySku = new Map(inventory.map((item, i) => [item.sku, i + 1]));
const channelIdByCode = new Map<string, number>(CHANNELS.map((c, i) => [c.code, i + 1]));

// baht in the fixture, satang in the column
const tileValue = (t: { value: number; unit: string }) =>
  t.unit === "satang" ? [money(t.value), null] : [null, t.value];

let metricId = 0;
insert(
  "dashboard_metrics",
  ["id", "shop_id", "scope", "period", "metric_key", "label", "value_satang", "value_num", "unit", "note", "trend", "sort_order"],
  [
    // the Today view's period selector, one row per period per figure
    ...periodMetrics.flatMap((p) =>
      (
        [
          ["profit", "กำไร", money(p.profit), null, "satang"],
          ["sales", "ยอดขายรวม", money(p.sales), null, "satang"],
          ["ads", "ค่าโฆษณา", money(p.ads), null, "satang"],
          ["orders", "ออเดอร์ทั้งหมด", null, p.orders, "count"],
          ["change", "เปลี่ยนแปลง", null, p.changePercent, "percent"],
        ] as [string, string, number | null, number | null, string][]
      ).map(([key, label, satangValue, numValue, unit], index) => [
        ++metricId, 1, "today", p.period, key, label, satangValue, numValue, unit, null, null, index,
      ])
    ),
    // the per-view tile strips
    ...Object.entries(viewTiles).flatMap(([scope, tiles]) =>
      tiles.map((t, index) => {
        const [satangValue, numValue] = tileValue(t);
        return [
          ++metricId, 1, scope, null, t.key, t.label, satangValue, numValue, t.unit,
          t.note || null, t.trend ?? null, index,
        ];
      })
    ),
  ]
);

insert(
  "channel_metrics",
  ["id", "shop_id", "channel_id", "period", "sales_satang", "order_count", "profit_satang"],
  channelPerformance.map((c, i) => [
    i + 1, 1, channelIdByCode.get(c.channelCode)!, "วันนี้", money(c.sales), c.orders, money(c.profit),
  ])
);

insert(
  "customer_segments",
  ["id", "shop_id", "segment_key", "label", "customer_count", "note", "sort_order"],
  customerSegments.map((s, i) => [i + 1, 1, s.key, s.label, s.count, s.note, i])
);

insert(
  "regions",
  ["id", "shop_id", "name", "share_percent", "sort_order"],
  regionShares.map((r, i) => [i + 1, 1, r.name, r.sharePercent, i])
);

insert(
  "waterfall_steps",
  ["id", "shop_id", "label", "amount_satang", "kind", "sort_order"],
  waterfallSteps.map((w, i) => [i + 1, 1, w.label, money(w.amount), w.kind, i])
);

insert(
  "restock_suggestions",
  ["id", "shop_id", "product_id", "suggested_quantity", "sort_order"],
  restockSuggestions.map((r, i) => [i + 1, 1, productIdBySku.get(r.sku)!, r.quantity, i])
);

insert(
  "product_opportunities",
  ["id", "shop_id", "product_id", "growth_percent", "profit_satang", "accent", "sort_order"],
  productOpportunities.map((o, i) => [
    i + 1, 1, productIdBySku.get(o.sku)!, o.growthPercent, money(o.profit), o.accent, i,
  ])
);

insert(
  "recommendations",
  [
    "id", "shop_id", "scope", "kicker", "title_template", "title_amount_satang",
    "body_template", "body_amount_satang", "figure_label", "figure_satang",
    "figure_prefix", "figure_suffix", "cta_label", "secondary_cta_label", "sort_order",
  ],
  recommendationPanels.map((r, i) => [
    i + 1, 1, r.scope, r.kicker,
    r.title, r.titleAmount === null ? null : money(r.titleAmount),
    r.body, r.bodyAmount === null ? null : money(r.bodyAmount),
    r.figureLabel, r.figureAmount === null ? null : money(r.figureAmount),
    r.figurePrefix, r.figureSuffix, r.cta, r.secondaryCta, i,
  ])
);

// The demo owner behind the one-click sign-in. A real `demo` provider row rather than a
// bypass — and it carries no secret, because LINE Login is the destination (auth spec Q4).
insert(
  "users",
  ["id", "shop_id", "provider", "provider_user_id", "display_name", "picture_url", "role", "created_at"],
  [
    [1, 1, "demo", "demo-owner", "คุณมะลิ", null, "owner", SEED_AT.toISOString()],
    // a staff demo too, so the role difference can be shown to a client rather than described
    [2, 1, "demo", "demo-staff", "คุณฟ้า (พนักงาน)", null, "staff", SEED_AT.toISOString()],
  ]
);

// One channel is seeded degraded on purpose: three identical "ปกติ" rows would not show
// that the grid works. The fixtures already hint at it — inventory carries
// "TikTok รออัปเดต" as its sync_state.
insert(
  "channel_health",
  ["id", "shop_id", "channel_id", "state", "detail", "last_synced_at"],
  [
    [1, 1, channelId("TikTok Shop"), "degraded", null, minutesAgo(37)],
    [2, 1, channelId("Shopee"), "healthy", null, minutesAgo(2)],
    [3, 1, channelId("LINE MyShop"), "healthy", null, minutesAgo(4)],
  ]
);

// Per-product, per-channel stock currency (PIN-0016). Only ML-CL-006 on TikTok is behind,
// which is what makes the fixtures' two labels — "ครบ 3 ช่องทาง" and "TikTok รออัปเดต" —
// come back out of the derivation rather than being stored as prose.
const STOCK_CHANNELS = ["tiktok", "shopee", "line"] as const;
const PENDING: Record<string, string[]> = { "ML-CL-006": ["tiktok"] };

let syncId = 0;
insert(
  "inventory_channel_sync",
  ["id", "shop_id", "product_id", "channel_id", "state", "last_synced_at"],
  inventory.flatMap((item, index) =>
    STOCK_CHANNELS.map((code) => {
      const pending = (PENDING[item.sku] ?? []).includes(code);
      return [
        ++syncId, 1, index + 1, channelIdByCode.get(code)!,
        pending ? "pending" : "synced",
        pending ? minutesAgo(180) : minutesAgo(3),
      ];
    })
  )
);

console.log(out.join("\n"));
