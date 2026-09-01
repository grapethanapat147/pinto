import type { Conversation } from "../types";

export const conversations: Conversation[] = [
  { id: 1, name: "คุณปริม", channel: "TikTok", preview: "ถ้าสั่งวันนี้จะส่งทันวันศุกร์ไหมคะ", time: "10:41", unread: 2, order: "TT-10842", topic: "สอบถามการจัดส่ง", messages: [
    { from: "customer", text: "สวัสดีค่ะ สนใจแจกันสีครีม 2 ใบ", time: "10:39" },
    { from: "customer", text: "ถ้าสั่งวันนี้จะส่งทันวันศุกร์ไหมคะ", time: "10:41" },
  ] },
  { id: 2, name: "Nicha Home", channel: "Shopee", preview: "ได้รับสินค้าแล้ว สวยมากค่ะ", time: "10:28", unread: 1, order: "SP-48219", topic: "รีวิวหลังการขาย", messages: [
    { from: "shop", text: "พัสดุถึงแล้วหรือยังคะ หากมีปัญหาแจ้งเราได้เลยนะคะ", time: "เมื่อวาน" },
    { from: "customer", text: "ได้รับสินค้าแล้ว สวยมากค่ะ", time: "10:28" },
  ] },
  { id: 3, name: "ชนิดา ก.", channel: "TikTok", preview: "ขอเปลี่ยนที่อยู่ก่อนส่งได้ไหม", time: "10:17", unread: 3, order: "TT-10841", topic: "แก้ไขออเดอร์", messages: [
    { from: "customer", text: "ขอเปลี่ยนที่อยู่ก่อนส่งได้ไหมคะ พอดีพิมพ์บ้านเลขที่ผิด", time: "10:17" },
  ] },
  { id: 4, name: "บ้านใบไม้", channel: "LINE", preview: "ต้องการใบกำกับภาษีค่ะ", time: "09:54", unread: 1, order: "LN-39204", topic: "เอกสารการเงิน", messages: [
    { from: "customer", text: "รบกวนออกใบกำกับภาษีในนามบริษัทได้ไหมคะ", time: "09:54" },
  ] },
];
