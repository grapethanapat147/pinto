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
import { orders } from "../app/fixtures/orders.ts";
import { payouts } from "../app/fixtures/payouts.ts";
import {
  channelPerformance, customerSegments, periodMetrics, productOpportunities,
  recommendationPanels, regionShares, restockSuggestions, viewTiles, waterfallSteps,
} from "../app/fixtures/metrics.ts";

const SHOP = "ร้าน Mali Living";

/* ---------- conversions ---------- */

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

/** Day 0 is the seed date; `hhmm` is a wall-clock time on that day. */
function at(hhmm: string, dayOffset = 0): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(SEED_AT);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function dateOnly(dayOffset: number): string {
  const d = new Date(SEED_AT);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
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
  { code: "tiktok", displayName: "TikTok Shop", kind: "marketplace" },
  { code: "shopee", displayName: "Shopee", kind: "marketplace" },
  { code: "line", displayName: "LINE MyShop", kind: "chat" },
  { code: "tiktok_ads", displayName: "TikTok Ads", kind: "ads" },
  { code: "meta_ads", displayName: "Meta", kind: "ads" },
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
  "messages", "conversations", "orders", "inventory_levels", "products",
  "actions", "campaigns", "payouts",
  // presentation scaffolding (schema-v1 Q1c)
  "dashboard_metrics", "channel_metrics", "customer_segments", "regions",
  "waterfall_steps", "restock_suggestions", "product_opportunities", "recommendations",
  "channels", "shops",
]) {
  out.push(`DELETE FROM \`${t}\`;`);
}

insert("shops", ["id", "name", "created_at"], [[1, SHOP, SEED_AT.toISOString()]]);

insert(
  "channels",
  ["id", "shop_id", "code", "display_name", "kind"],
  CHANNELS.map((c, i) => [i + 1, 1, c.code, c.displayName, c.kind])
);

insert(
  "products",
  ["id", "shop_id", "sku", "name", "category"],
  inventory.map((item, i) => [i + 1, 1, item.sku, item.name, item.category])
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
    i + 1, 1, channelId(o.channel), o.id, o.customer, satang(o.total), o.status, at(o.time),
  ])
);

const orderIdByExternal = new Map(orders.map((o, i) => [o.id, i + 1]));

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
const money = (baht: number) => Math.round(baht * 100);
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

console.log(out.join("\n"));
