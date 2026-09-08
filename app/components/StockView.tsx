"use client";

import { useState } from "react";
import { ShoppingCart, Sparkles } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { InventoryItem, Notify } from "../types";

export function StockView({ inventory, notify }: { inventory: InventoryItem[]; notify: Notify }) {
  const [stockFilter, setStockFilter] = useState("ทั้งหมด");
  const stockFilters = ["ทั้งหมด", "ใกล้หมด", "หมดสต๊อก", "พร้อมขาย"];
  const visibleInventory = stockFilter === "ทั้งหมด" ? inventory : inventory.filter((item) => item.status === stockFilter);

  return (
    <>
      <section className="compact-metrics stock-metrics">
        <article><p>สินค้าพร้อมขาย</p><h3>178</h3><small className="up">95.7% ของสินค้าทั้งหมด</small></article>
        <article><p>สินค้าใกล้หมด</p><h3 className="text-warning">6</h3><small>ควรสั่งเพิ่มภายในวันนี้</small></article>
        <article><p>สินค้าหมดสต๊อก</p><h3 className="text-warning">2</h3><small>กระทบยอดขาย 3 ช่องทาง</small></article>
        <article><p>มูลค่าสต๊อก</p><h3>฿386,420</h3><small className="up">หมุนเวียนเฉลี่ย 18 วัน</small></article>
      </section>

      <section className="stock-layout">
        <article className="panel data-panel stock-panel">
          <div className="panel-heading stock-heading"><div><p>สต๊อกทุกช่องทาง</p><h3>รู้จำนวนจริงก่อนรับออเดอร์เพิ่ม</h3></div><button className="primary-button icon-text-button" onClick={() => notify("ตัวอย่าง — การสร้างใบสั่งซื้อยังไม่เปิดใช้งาน", "demo")}><ShoppingCart size={16} />สร้างใบสั่งซื้อ</button></div>
          <div className="order-filter-row" aria-label="กรองสถานะสต๊อก">{stockFilters.map((item) => <button key={item} className={stockFilter === item ? "active" : ""} onClick={() => setStockFilter(item)}>{item}</button>)}</div>
          <div className="stock-table table-scroll">
            <div className="stock-row stock-head"><span>สินค้า</span><span>คงเหลือ</span><span>จองแล้ว</span><span>ขายได้อีก</span><span>ซิงก์ช่องทาง</span><span>สถานะ</span></div>
            {visibleInventory.map((item) => (
              <button className="stock-row" key={item.sku} onClick={() => notify(`ตัวอย่าง — หน้ารายละเอียด ${item.name} ยังไม่เปิดใช้งาน`, "demo")}>
                <span><strong>{item.name}</strong><small>{item.sku} · {item.category}</small></span>
                <strong>{item.stock}</strong><span>{item.reserved}</span><span>{item.daysLeft > 0 ? `${item.daysLeft} วัน` : "—"}</span><span>{item.sync}</span>
                <StatusPill tone={item.status === "พร้อมขาย" ? "good" : item.status === "ใกล้หมด" ? "warning" : "danger"}>{item.status}</StatusPill>
              </button>
            ))}
          </div>
          {visibleInventory.length === 0 && (
            <EmptyState title="ไม่พบสินค้าในหมวดนี้" detail="ลองเลือกตัวกรองอื่น หรือเพิ่มสินค้าเข้าระบบ" />
          )}
        </article>

        <aside className="panel stock-insight">
          <span className="spark dark"><Sparkles size={20} /></span><p>Pinto แนะนำ</p><h3>สั่งเพิ่ม 3 รายการก่อนเที่ยงวันนี้</h3><p>หากสั่งตามยอดแนะนำ ร้านจะมีสินค้าเพียงพอสำหรับยอดขายประมาณ 14 วัน โดยใช้เงินเพิ่มไม่เกิน ฿24,600</p>
          <div className="restock-list">
            <div><span>แจกันเซรามิกสีครีม</span><strong>+90 ชิ้น</strong></div>
            <div><span>โคมไฟ Cloud</span><strong>+45 ชิ้น</strong></div>
            <div><span>ผ้าปูโต๊ะ Linen Sand</span><strong>+60 ชิ้น</strong></div>
          </div>
          <button className="primary-button wide" onClick={() => notify("ตัวอย่าง — ใบสั่งซื้อยังไม่เปิดใช้งาน จึงยังไม่ได้เพิ่มสินค้า", "demo")}>เพิ่มทั้งหมดในใบสั่งซื้อ</button>
        </aside>
      </section>

      <section className="channel-sync-grid" aria-label="สถานะการเชื่อมต่อสต๊อก">
        <article><i className="channel-logo tiktok">T</i><div><strong>TikTok Shop</strong><span>ซิงก์ล่าสุด 1 นาทีที่แล้ว</span></div><StatusPill tone="good">ปกติ</StatusPill></article>
        <article><i className="channel-logo shopee">S</i><div><strong>Shopee</strong><span>ซิงก์ล่าสุด 2 นาทีที่แล้ว</span></div><StatusPill tone="good">ปกติ</StatusPill></article>
        <article><i className="channel-logo line">L</i><div><strong>LINE MyShop</strong><span>ซิงก์ล่าสุด 4 นาทีที่แล้ว</span></div><StatusPill tone="good">ปกติ</StatusPill></article>
      </section>
    </>
  );
}
