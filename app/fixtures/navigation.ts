import {
  Boxes,
  Home as HomeIcon,
  Inbox,
  PackageCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";

import type { NavItem, View, ViewTitle } from "../types";

export const navItems: NavItem[] = [
  { id: "today", label: "วันนี้", icon: HomeIcon },
  { id: "actions", label: "สิ่งที่ต้องทำ", icon: Sparkles },
  { id: "orders", label: "ออเดอร์", icon: PackageCheck },
  { id: "inbox", label: "ข้อความลูกค้า", icon: Inbox },
  { id: "stock", label: "สินค้าและสต๊อก", icon: Boxes },
  { id: "customers", label: "ลูกค้า", icon: UsersRound },
  { id: "growth", label: "การเติบโต", icon: TrendingUp },
  { id: "money", label: "การเงิน", icon: WalletCards },
];

export const viewTitles: Record<View, ViewTitle> = {
  today: { kicker: "หน้าหลัก", title: "ภาพรวมร้าน" },
  actions: { kicker: "Action Center", title: "เรื่องที่รอการตัดสินใจ" },
  orders: { kicker: "284 ออเดอร์วันนี้", title: "ออเดอร์ทุกช่องทาง" },
  inbox: { kicker: "12 ข้อความรอตอบ", title: "กล่องข้อความลูกค้า" },
  stock: { kicker: "สินค้า 186 รายการ", title: "สินค้าและสต๊อก" },
  growth: { kicker: "การตลาดและยอดขาย", title: "เติบโตแบบมีกำไร" },
  customers: { kicker: "ลูกค้า 3,842 คน", title: "เข้าใจและดูแลลูกค้า" },
  money: { kicker: "ข้อมูลการเงินล่าสุด", title: "เงินเข้า เงินออก และกำไรจริง" },
};
