/**
 * The dashboard figures that were hardcoded in `app/components/*.tsx` until PIN-0009,
 * transcribed here so the seed can load them (spec D2) and so the transcription is
 * reviewable in one place rather than scattered across seven JSX files.
 *
 * TEMPORARY, like the tables they feed: once there is enough data behind them these
 * become queries over the domain tables. See `.codex/specs/schema-v1.md` Q1.
 *
 * Amounts are baht as displayed; the seed converts to satang.
 */

export type SeedTile = {
  key: string;
  label: string;
  /** Baht amount, plain count, percentage, minutes, or ratio — `unit` says which. */
  value: number;
  unit: "satang" | "count" | "percent" | "minutes" | "ratio";
  note: string;
  trend?: "up" | "down" | "warning";
};

/** Today view, one row per period selector. */
export const periodMetrics = [
  { period: "วันนี้", profit: 48720, sales: 126840, ads: 18460, orders: 284, changePercent: 12.4 },
  { period: "7 วัน", profit: 286940, sales: 782560, ads: 109280, orders: 1842, changePercent: 8.7 },
  { period: "30 วัน", profit: 1184320, sales: 3246780, ads: 456190, orders: 7639, changePercent: 16.2 },
];

/** Today view channel table. Margin is derived from profit/sales, so it is not here. */
export const channelPerformance = [
  { channelCode: "tiktok", sales: 68420, orders: 142, profit: 24930 },
  { channelCode: "shopee", sales: 42180, orders: 96, profit: 16740 },
  { channelCode: "line", sales: 16240, orders: 46, profit: 7050 },
];

/** The four-tile strips at the top of Orders, Stock, Inbox and Growth. */
export const viewTiles: Record<string, SeedTile[]> = {
  today: [
    { key: "pending_payout", label: "เงินรอโอน", value: 73290, unit: "satang", note: "● ภายใน 2–3 วัน", trend: "warning" },
    { key: "sales_note", label: "ยอดขายรวม", value: 8.2, unit: "percent", note: "● 8.2% จากช่วงก่อน", trend: "up" },
    { key: "orders_note", label: "ออเดอร์ทั้งหมด", value: 16, unit: "count", note: "● เพิ่มขึ้น 16 รายการ", trend: "up" },
    { key: "quick_pack", label: "แพ็กออเดอร์", value: 47, unit: "count", note: "47 รายการรอแพ็ก" },
    { key: "quick_reply", label: "ตอบลูกค้า", value: 12, unit: "count", note: "12 ข้อความรอตอบ" },
    { key: "quick_restock", label: "เติมสต๊อก", value: 6, unit: "count", note: "6 รายการใกล้หมด" },
    { key: "quick_campaign", label: "ดูแคมเปญ", value: 2, unit: "count", note: "2 รายการควรปรับงบ" },
  ],
  orders: [
    { key: "new", label: "ออเดอร์ใหม่", value: 284, unit: "count", note: "↑ 6.0% จากเมื่อวาน", trend: "up" },
    { key: "to_pack", label: "รอแพ็ก", value: 47, unit: "count", note: "ควรเสร็จก่อน 14:00 น." },
    { key: "to_review", label: "ต้องตรวจสอบ", value: 8, unit: "count", note: "มีความเสี่ยงผิดปกติ", trend: "warning" },
    { key: "delivered", label: "จัดส่งสำเร็จ", value: 229, unit: "count", note: "อัตราสำเร็จ 97.2%", trend: "up" },
  ],
  stock: [
    { key: "sellable", label: "สินค้าพร้อมขาย", value: 178, unit: "count", note: "95.7% ของสินค้าทั้งหมด", trend: "up" },
    { key: "low", label: "สินค้าใกล้หมด", value: 6, unit: "count", note: "ควรสั่งเพิ่มภายในวันนี้", trend: "warning" },
    { key: "out", label: "สินค้าหมดสต๊อก", value: 2, unit: "count", note: "กระทบยอดขาย 3 ช่องทาง", trend: "warning" },
    { key: "value", label: "มูลค่าสต๊อก", value: 386420, unit: "satang", note: "หมุนเวียนเฉลี่ย 18 วัน", trend: "up" },
  ],
  inbox: [
    { key: "today", label: "ข้อความวันนี้", value: 36, unit: "count", note: "ครบทุกช่องทาง", trend: "up" },
    { key: "waiting", label: "รอตอบ", value: 12, unit: "count", note: "3 ข้อความเกี่ยวกับออเดอร์", trend: "warning" },
    { key: "response_time", label: "เวลาตอบเฉลี่ย", value: 4, unit: "minutes", note: "เร็วขึ้น 38%", trend: "up" },
    { key: "chat_sales", label: "ปิดการขายจากแชต", value: 18420, unit: "satang", note: "21 ออเดอร์วันนี้", trend: "up" },
  ],
  growth: [
    { key: "ad_sales", label: "ยอดขายจากโฆษณา", value: 61450, unit: "satang", note: "↑ 11.6%", trend: "up" },
    { key: "ad_spend", label: "ค่าโฆษณา", value: 18460, unit: "satang", note: "↑ 4.1%", trend: "down" },
    { key: "roas", label: "ROAS รวม", value: 3.84, unit: "ratio", note: "สูงกว่าเป้า 0.34", trend: "up" },
    { key: "ad_profit", label: "กำไรจาก Ads", value: 21720, unit: "satang", note: "Margin 35.3%", trend: "up" },
  ],
  money: [
    { key: "profit", label: "กำไรโดยประมาณวันนี้", value: 48720, unit: "satang", note: "รวมข้อมูลครบ 98.6%", trend: "up" },
    { key: "withdrawable", label: "เงินพร้อมถอน", value: 24680, unit: "satang", note: "" },
    { key: "pending", label: "เงินรอโอน", value: 73290, unit: "satang", note: "TikTok 53% · Shopee 33% · LINE 14%" },
  ],
};

export const customerSegments = [
  { key: "best", label: "ลูกค้าคนสำคัญ", count: 286, note: "สร้าง 42% ของรายได้ทั้งหมด" },
  { key: "repeat", label: "ลูกค้าซื้อซ้ำ", count: 1148, note: "อัตราซื้อซ้ำ 29.8%" },
  { key: "sleeping", label: "กำลังจะหายไป", count: 194, note: "ไม่ได้ซื้อสินค้านานกว่า 60 วัน" },
];

/** `width` is the bar length; the label percentage is `sharePercent`. */
export const regionShares = [
  { name: "กรุงเทพมหานคร", sharePercent: 32, width: 100 },
  { name: "ชลบุรี", sharePercent: 12, width: 38 },
  { name: "เชียงใหม่", sharePercent: 9, width: 28 },
  { name: "นครราชสีมา", sharePercent: 7, width: 22 },
  { name: "ขอนแก่น", sharePercent: 6, width: 19 },
];

/** Money view profit waterfall. Labels abbreviate on read: 126840 -> "฿126.8k". */
export const waterfallSteps = [
  { label: "ยอดขาย", amount: 126840, kind: "sales" as const },
  { label: "ต้นทุน", amount: 42700, kind: "cost" as const },
  { label: "โฆษณา", amount: 18460, kind: "ads" as const },
  { label: "ค่าธรรมเนียม", amount: 17000, kind: "fees" as const },
  { label: "กำไร", amount: 48720, kind: "profit" as const },
];

/** Keyed by product SKU so the seed can resolve real foreign keys. */
export const restockSuggestions = [
  { sku: "ML-CV-018", quantity: 90 },
  { sku: "ML-CL-006", quantity: 45 },
  { sku: "ML-LN-012", quantity: 60 },
];

export const productOpportunities = [
  { sku: "ML-CV-018", growthPercent: 34, profit: 8420, accent: "cream" },
  { sku: "ML-AG-024", growthPercent: 21, profit: 6190, accent: "amber" },
  { sku: "ML-CL-006", growthPercent: 18, profit: 4870, accent: "blue" },
];

/**
 * The "Pinto แนะนำ" advisory panels (PIN-0010).
 *
 * `{amount}` is interpolated on read, so the money stays an integer instead of being
 * frozen into the sentence. Amounts are baht here; the seed converts to satang.
 */
export const recommendationPanels = [
  {
    scope: "stock",
    kicker: "Pinto แนะนำ",
    title: "สั่งเพิ่ม 3 รายการก่อนเที่ยงวันนี้",
    titleAmount: null,
    body: "หากสั่งตามยอดแนะนำ ร้านจะมีสินค้าเพียงพอสำหรับยอดขายประมาณ 14 วัน โดยใช้เงินเพิ่มไม่เกิน {amount}",
    bodyAmount: 24600,
    figureLabel: null,
    figureAmount: null,
    figurePrefix: null,
    figureSuffix: null,
    cta: "เพิ่มทั้งหมดในใบสั่งซื้อ",
    secondaryCta: null,
  },
  {
    scope: "growth",
    kicker: "Pinto แนะนำ",
    title: "โยกงบ {amount} ไปที่ Ceramic Set",
    titleAmount: 1200,
    body: "แคมเปญนี้สร้างกำไรต่อบาทสูงกว่า Home Refresh 41% ในช่วง 3 วันที่ผ่านมา",
    bodyAmount: null,
    figureLabel: "กำไรที่อาจเพิ่ม",
    figureAmount: 2080,
    figurePrefix: "+ ",
    figureSuffix: " / วัน",
    cta: "ดูแผนการปรับงบ",
    secondaryCta: "ไว้ทีหลัง",
  },
  {
    scope: "customers",
    kicker: "โอกาสดูแลลูกค้า",
    title: "ลูกค้า 82 คนพร้อมกลับมาซื้อซ้ำ",
    titleAmount: null,
    body: "กลุ่มนี้เคยซื้อ Home Living มากกว่า 2 ครั้ง และมีแนวโน้มตอบรับคูปองส่งฟรีสูง",
    bodyAmount: null,
    figureLabel: "มูลค่าที่คาดการณ์",
    figureAmount: 46700,
    figurePrefix: null,
    figureSuffix: null,
    cta: "สร้างกลุ่มลูกค้า",
    secondaryCta: null,
  },
];
