/**
 * Pinto data model — see `.codex/specs/schema-v1.md`.
 *
 * Conventions, all deliberate and all load-bearing:
 * - Money is INTEGER **satang**, never text and never float (฿1,890 -> 189000).
 * - Timestamps are ISO-8601 text; the seed anchors them to its own run time so the demo
 *   always reads as "today" (spec Q2).
 * - Every table carries a non-null `shop_id` so milestone 4 can add authentication by
 *   filtering a column that already exists (spec D5).
 * - Derived values are NOT columns: campaign ROAS, inventory status, the Action Center
 *   total and the open-action count are all computed (spec F2).
 * - Migrations are additive only — no DROP, no destructive ALTER — because
 *   migration-on-deploy is unverified and has no rollback (spec Q4).
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

/* ------------------------------------------------------------------ *
 * Domain
 * ------------------------------------------------------------------ */

export const shops = sqliteTable("shops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at"),
});

/**
 * The fixtures spell one channel four ways — "TikTok", "TikTok Shop", "TikTok Ads",
 * "Shopee + TikTok". Milestone 3's adapter interface needs one canonical list.
 */
export const channels = sqliteTable(
  "channels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    code: text("code").notNull(),
    displayName: text("display_name").notNull(),
    kind: text("kind", { enum: ["marketplace", "ads", "chat"] }).notNull(),
  },
  (table) => [unique("channels_shop_code").on(table.shopId, table.code)]
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
  },
  (table) => [unique("products_shop_sku").on(table.shopId, table.sku)]
);

/**
 * Split from `products` so stock can become per-channel later without a rewrite — that
 * split is the premise of the whole product.
 *
 * `daysLeft` is denormalised: it should be on_hand / sales velocity, and there is no
 * velocity data yet. `status` is absent on purpose — it is derivable from on_hand and
 * daysLeft.
 */
export const inventoryLevels = sqliteTable(
  "inventory_levels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    productId: integer("product_id").notNull().references(() => products.id),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    daysLeft: integer("days_left"),
    syncState: text("sync_state").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [unique("inventory_levels_product").on(table.productId)]
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    /** Marketplace-facing id such as "TT-10842"; the primary key stays internal. */
    externalId: text("external_id").notNull(),
    customerName: text("customer_name").notNull(),
    totalSatang: integer("total_satang").notNull(),
    status: text("status").notNull(),
    placedAt: timestamp("placed_at"),
  },
  (table) => [
    unique("orders_shop_external").on(table.shopId, table.externalId),
    index("orders_shop_placed").on(table.shopId, table.placedAt),
    index("orders_shop_status").on(table.shopId, table.status),
  ]
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    /** Nullable: not every conversation is about an order. */
    orderId: integer("order_id").references(() => orders.id),
    customerName: text("customer_name").notNull(),
    topic: text("topic").notNull(),
    unreadCount: integer("unread_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at"),
  },
  (table) => [index("conversations_shop_last_message").on(table.shopId, table.lastMessageAt)]
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    conversationId: integer("conversation_id").notNull().references(() => conversations.id),
    sender: text("sender", { enum: ["customer", "shop"] }).notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at"),
  },
  (table) => [index("messages_conversation_sent").on(table.conversationId, table.sentAt)]
);

/**
 * `resolvedAt IS NULL` is the open-action predicate. The Action Center's headline total
 * is SUM(impact_satang) over open rows, not a stored column — that is what makes it drop
 * when an action is resolved (spec Q3).
 *
 * `channelLabel` stays free text because "Shopee + TikTok" is genuinely two channels, and
 * modelling that needs a join table this milestone does not.
 */
export const actions = sqliteTable(
  "actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelLabel: text("channel_label").notNull(),
    tone: text("tone", { enum: ["danger", "warning", "success"] }).notNull(),
    label: text("label").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    /** Prefix shown before the amount: "เสี่ยงเสีย", "มูลค่า", "โอกาส", "ขอคืนได้". */
    impactKind: text("impact_kind").notNull(),
    impactSatang: integer("impact_satang").notNull(),
    insight: text("insight").notNull(),
    recommendation: text("recommendation").notNull(),
    detectedAt: timestamp("detected_at"),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("actions_shop_resolved").on(table.shopId, table.resolvedAt)]
);

/** ROAS is absent on purpose: it is exactly revenue/spend for every fixture row. */
export const campaigns = sqliteTable(
  "campaigns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    name: text("name").notNull(),
    spendSatang: integer("spend_satang").notNull(),
    revenueSatang: integer("revenue_satang").notNull(),
    health: text("health").notNull(),
  },
  (table) => [unique("campaigns_shop_name").on(table.shopId, table.name)]
);

export const payouts = sqliteTable(
  "payouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    /** ISO date, no time — payouts land on a day, not at an instant. */
    expectedOn: text("expected_on").notNull(),
    orderCount: integer("order_count").notNull(),
    amountSatang: integer("amount_satang").notNull(),
    status: text("status").notNull(),
  },
  (table) => [index("payouts_shop_expected").on(table.shopId, table.expectedOn)]
);

/* ------------------------------------------------------------------ *
 * Presentation scaffolding — TEMPORARY
 *
 * Per resolved Q1(c), the 41 figures currently hardcoded in app/components become seeded
 * data so they stop being JSX literals. They are NOT the long-term model: the later
 * aggregation ticket replaces most of these with queries over the domain tables above.
 * Nothing here should grow new consumers.
 * ------------------------------------------------------------------ */

/**
 * The metric tiles across Today / Orders / Stock / Inbox / Growth. One row per tile.
 * `valueSatang` xor `valueNum` carries the number; `unit` says how to render it.
 */
export const dashboardMetrics = sqliteTable(
  "dashboard_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    /** Which screen the tile belongs to: "today" | "orders" | "stock" | "inbox" | "growth" | "money". */
    scope: text("scope").notNull(),
    /** Period selector on the Today view: "today" | "7d" | "30d"; null when not period-bound. */
    period: text("period"),
    metricKey: text("metric_key").notNull(),
    label: text("label").notNull(),
    valueSatang: integer("value_satang"),
    valueNum: real("value_num"),
    unit: text("unit", { enum: ["satang", "count", "percent", "minutes", "ratio"] }).notNull(),
    note: text("note"),
    trend: text("trend", { enum: ["up", "down", "warning", "neutral"] }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [unique("dashboard_metrics_key").on(table.shopId, table.scope, table.period, table.metricKey)]
);

export const channelMetrics = sqliteTable(
  "channel_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    period: text("period").notNull(),
    salesSatang: integer("sales_satang").notNull(),
    orderCount: integer("order_count").notNull(),
    profitSatang: integer("profit_satang").notNull(),
  },
  (table) => [unique("channel_metrics_key").on(table.shopId, table.channelId, table.period)]
);

export const customerSegments = sqliteTable("customer_segments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  segmentKey: text("segment_key").notNull(),
  label: text("label").notNull(),
  customerCount: integer("customer_count").notNull(),
  note: text("note").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const regions = sqliteTable("regions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  name: text("name").notNull(),
  sharePercent: real("share_percent").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** The Money view's profit waterfall: sales, minus costs, down to profit. */
export const waterfallSteps = sqliteTable("waterfall_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  label: text("label").notNull(),
  amountSatang: integer("amount_satang").notNull(),
  kind: text("kind", { enum: ["sales", "cost", "ads", "fees", "profit"] }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const restockSuggestions = sqliteTable("restock_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  productId: integer("product_id").notNull().references(() => products.id),
  suggestedQuantity: integer("suggested_quantity").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productOpportunities = sqliteTable("product_opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  productId: integer("product_id").notNull().references(() => products.id),
  growthPercent: real("growth_percent").notNull(),
  profitSatang: integer("profit_satang").notNull(),
  accent: text("accent").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
