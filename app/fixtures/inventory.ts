import type { InventoryItem } from "../types";

export const inventory: InventoryItem[] = [
  { sku: "ML-CV-018", name: "แจกันเซรามิกสีครีม", category: "Home Living", stock: 42, reserved: 18, daysLeft: 3, sync: "ครบ 3 ช่องทาง", status: "ใกล้หมด" },
  { sku: "ML-CL-006", name: "โคมไฟ Cloud", category: "Lighting", stock: 0, reserved: 7, daysLeft: 0, sync: "TikTok รออัปเดต", status: "หมดสต๊อก" },
  { sku: "ML-AG-024", name: "ชุดแก้ว Amber 4 ใบ", category: "Dining", stock: 86, reserved: 12, daysLeft: 14, sync: "ครบ 3 ช่องทาง", status: "พร้อมขาย" },
  { sku: "ML-LN-012", name: "ผ้าปูโต๊ะ Linen Sand", category: "Dining", stock: 19, reserved: 6, daysLeft: 4, sync: "ครบ 3 ช่องทาง", status: "ใกล้หมด" },
  { sku: "ML-TR-031", name: "ถาดไม้โค้ง Natural", category: "Home Living", stock: 112, reserved: 9, daysLeft: 21, sync: "ครบ 3 ช่องทาง", status: "พร้อมขาย" },
];
