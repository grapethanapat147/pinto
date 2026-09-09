"use client";

import { useState } from "react";
import { ShoppingCart, Sparkles } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { ChannelSyncRow, DashboardMetrics, InventoryItem, Notify, RecommendationPanel } from "../types";

export function StockView({ inventory, metrics, channelSync, recommendation, notify }: { inventory: InventoryItem[]; metrics: DashboardMetrics; channelSync: ChannelSyncRow[]; recommendation?: RecommendationPanel; notify: Notify }) {
  const tiles = metrics.tiles.stock ?? [];
  const [stockFilter, setStockFilter] = useState("ทั้งหมด");
  const stockFilters = ["ทั้งหมด", "ใกล้หมด", "หมดสต๊อก", "พร้อมขาย"];
  const visibleInventory = stockFilter === "ทั้งหมด" ? inventory : inventory.filter((item) => item.status === stockFilter);

  return (
    <>
      <section className="compact-metrics stock-metrics">
        {tiles.map((tile) => (
          <article key={tile.key}><p>{tile.label}</p><h3 className={tile.trend === "warning" ? "text-warning" : undefined}>{tile.value}</h3><small className={tile.trend === "up" ? "up" : tile.trend === "down" ? "down" : undefined}>{tile.note}</small></article>
        ))}
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
          <span className="spark dark"><Sparkles size={20} /></span><p>{recommendation?.kicker}</p><h3>{recommendation?.title}</h3><p>{recommendation?.body}</p>
          <div className="restock-list">{metrics.restock.map((item) => (
            <div key={item.name}><span>{item.name}</span><strong>{item.quantity}</strong></div>
          ))}</div>
          <button className="primary-button wide" onClick={() => notify("ตัวอย่าง — ใบสั่งซื้อยังไม่เปิดใช้งาน จึงยังไม่ได้เพิ่มสินค้า", "demo")}>{recommendation?.cta}</button>
        </aside>
      </section>

      <section className="channel-sync-grid" aria-label="สถานะการเชื่อมต่อสต๊อก">
        {channelSync.map((row) => (
          <article key={row.code}>
            <i className={`channel-logo ${row.accent}`}>{row.displayName[0]}</i>
            <div><strong>{row.displayName}</strong><span>{row.detail}</span></div>
            <StatusPill tone={row.tone}>{row.label}</StatusPill>
          </article>
        ))}
      </section>
    </>
  );
}
