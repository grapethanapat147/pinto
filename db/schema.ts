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
    /** Short form used in tables and chat headers, e.g. "TikTok" for "TikTok Shop". */
    shortName: text("short_name").notNull().default(""),
    /** Logo class. Data rather than something recovered by sniffing the display name. */
    accent: text("accent").notNull().default("tiktok"),
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
    /** @deprecated PIN-0016 — superseded by `inventoryChannelSync`. Nothing reads this.
     *  Kept because migrations are additive only (spec Q4); dropping it needs the
     *  migration-on-deploy question answered first. */
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
    /** Editorial summary shown in the list. Not derivable from the messages. */
    preview: text("preview").notNull().default(""),
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

/**
 * The "Pinto แนะนำ" advisory panels (PIN-0010).
 *
 * Text is stored as a template with an `{amount}` placeholder rather than a finished
 * sentence, so the money stays an integer and can be recomputed — storing
 * "โยกงบ ฿1,200 ไปที่ Ceramic Set" whole would freeze the number into prose, which is
 * exactly the problem schema-v1 F3 called out.
 */
export const recommendations = sqliteTable(
  "recommendations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    /** Which view the panel belongs to: "stock" | "growth" | "customers". */
    scope: text("scope").notNull(),
    kicker: text("kicker").notNull(),
    titleTemplate: text("title_template").notNull(),
    titleAmountSatang: integer("title_amount_satang"),
    bodyTemplate: text("body_template").notNull(),
    bodyAmountSatang: integer("body_amount_satang"),
    /** The boxed figure some panels show under the body. */
    figureLabel: text("figure_label"),
    figureSatang: integer("figure_satang"),
    figurePrefix: text("figure_prefix"),
    figureSuffix: text("figure_suffix"),
    ctaLabel: text("cta_label").notNull(),
    secondaryCtaLabel: text("secondary_cta_label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [unique("recommendations_shop_scope").on(table.shopId, table.scope)]
);

/* ------------------------------------------------------------------ *
 * Identity (PIN-0011)
 * ------------------------------------------------------------------ */

/**
 * A user is `(provider, providerUserId)` and carries **no secret at all** — LINE Login is
 * the destination, so there is no password to store (auth spec Q4).
 *
 * `provider` is "line" or "demo". The demo provider is a real row rather than a hidden
 * bypass, so a one-click demo sign-in is visible in the database.
 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    provider: text("provider", { enum: ["line", "demo"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    displayName: text("display_name").notNull(),
    pictureUrl: text("picture_url"),
    role: text("role", { enum: ["owner", "staff"] }).notNull().default("staff"),
    createdAt: timestamp("created_at"),
  },
  (table) => [unique("users_provider_identity").on(table.provider, table.providerUserId)]
);

/**
 * Sessions live here rather than in a signed cookie so logout can actually revoke.
 *
 * `id` is the **SHA-256 of the token**, never the token itself: the cookie holds the only
 * copy of the raw value, so a database leak does not hand over live sessions.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    expiresAt: text("expires_at").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [index("sessions_user").on(table.userId)]
);


/**
 * Per-channel connection state, owned by that channel's adapter (PIN-0015).
 *
 * StockView's sync grid was three hardcoded blocks that always read "ปกติ", so it could
 * never show a real problem — the one thing a sync indicator exists to do.
 */
export const channelHealth = sqliteTable(
  "channel_health",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    state: text("state", { enum: ["healthy", "syncing", "degraded", "disconnected"] }).notNull(),
    /** Shown beside the state when the adapter has something specific to say. */
    detail: text("detail"),
    lastSyncedAt: text("last_synced_at"),
  },
  (table) => [unique("channel_health_channel").on(table.channelId)]
);


/**
 * Per-product, per-channel stock currency (PIN-0016).
 *
 * Replaces `inventory_levels.sync_state`, which flattened a per-channel fact into one
 * Thai string on the product, so nothing could ask "is this product synced to Shopee?".
 * The product's label and a channel's stock detail are both derived from these rows, so
 * the two cannot disagree the way two seeded copies did.
 */
export const inventoryChannelSync = sqliteTable(
  "inventory_channel_sync",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    productId: integer("product_id").notNull().references(() => products.id),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    state: text("state", { enum: ["synced", "pending", "failed"] }).notNull(),
    lastSyncedAt: text("last_synced_at"),
  },
  (table) => [unique("inventory_channel_sync_pair").on(table.productId, table.channelId)]
);
