import type { LucideIcon } from "lucide-react";

export type View =
  | "today"
  | "actions"
  | "orders"
  | "inbox"
  | "stock"
  | "customers"
  | "growth"
  | "money";

export type ActionTone = "danger" | "warning" | "success";

export type NavItem = { id: View; label: string; icon: LucideIcon };

export type ViewTitle = { kicker: string; title: string };

export type ToastTone = "success" | "demo";

/** `demo` marks feedback for a control this prototype does not actually implement. */
export type Notify = (message: string, tone?: ToastTone) => void;

export type ShopAction = {
  id: number;
  tone: ActionTone;
  label: string;
  title: string;
  detail: string;
  impact: string;
  /** Same amount as `impact`, for arithmetic. Absent in the fixtures. */
  impactSatang?: number;
  channel: string;
  source: string;
  insight: string;
  recommendation: string;
};

export type InventoryItem = {
  sku: string;
  name: string;
  category: string;
  stock: number;
  reserved: number;
  daysLeft: number;
  sync: string;
  status: "พร้อมขาย" | "ใกล้หมด" | "หมดสต๊อก";
};

export type ConversationMessage = {
  from: "customer" | "shop";
  text: string;
  time: string;
};

export type Conversation = {
  id: number;
  name: string;
  channel: string;
  preview: string;
  time: string;
  unread: number;
  order: string;
  topic: string;
  messages: ConversationMessage[];
};

export type Order = {
  id: string;
  customer: string;
  channel: string;
  total: string;
  status: string;
  time: string;
};

export type Campaign = {
  name: string;
  channel: string;
  spend: string;
  revenue: string;
  roas: string;
  health: string;
};

export type Payout = {
  platform: string;
  date: string;
  orders: string;
  amount: string;
  status: string;
};

/* --- Presentation figures (PIN-0009). Temporary scaffolding: see schema-v1 Q1. --- */

export type MetricTile = {
  key: string;
  label: string;
  value: string;
  note: string;
  trend?: "up" | "down" | "warning";
};

export type PeriodFigures = { profit: string; sales: string; ads: string; orders: string; change: string };
export type ChannelRow = { channel: string; code: string; sales: string; orders: string; profit: string; margin: string };
export type SegmentRow = { key: string; label: string; count: string; note: string };
export type RegionRow = { name: string; value: string; width: number };
export type WaterfallRow = { label: string; amount: string; kind: string };
export type RestockRow = { name: string; quantity: string };
export type OpportunityRow = { name: string; metric: string; profit: string; accent: string };

export type DashboardMetrics = {
  periods: Record<string, PeriodFigures>;
  tiles: Record<string, MetricTile[]>;
  channels: ChannelRow[];
  segments: SegmentRow[];
  regions: RegionRow[];
  waterfall: WaterfallRow[];
  restock: RestockRow[];
  opportunities: OpportunityRow[];
};
