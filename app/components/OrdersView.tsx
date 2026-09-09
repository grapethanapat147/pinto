"use client";

import { useState } from "react";
import { Plus, Search, Truck } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { MetricTile, Notify, Order } from "../types";

export function OrdersView({ query, setQuery, orders: visibleOrders, tiles, notify }: { query: string; setQuery: (value: string) => void; orders: Order[]; tiles: MetricTile[]; notify: Notify }) {
  const [orderFilter, setOrderFilter] = useState("ทั้งหมด");
  const orderFilters = ["ทั้งหมด", "รอแพ็ก", "พร้อมส่ง", "ตรวจสอบ", "จัดส่งแล้ว"];
  const filteredOrders = orderFilter === "ทั้งหมด" ? visibleOrders : visibleOrders.filter((order) => order.status === orderFilter);
  return (
    <>
      <section className="order-metrics compact-metrics">
        {tiles.map((tile) => (
          <article key={tile.key}><p>{tile.label}</p><h3 className={tile.trend === "warning" ? "text-warning" : undefined}>{tile.value}</h3><small className={tile.trend === "up" ? "up" : tile.trend === "down" ? "down" : undefined}>{tile.note}</small></article>
        ))}
      </section>
      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="search-box"><span><Search size={18} /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาออเดอร์หรือลูกค้า" aria-label="ค้นหาออเดอร์" /></div>
          <div><button className="secondary-button icon-text-button" onClick={() => notify("ตัวอย่าง — การพิมพ์ใบปะหน้ายังไม่เชื่อมต่อกับขนส่งจริง", "demo")}><Truck size={16} />พิมพ์ใบปะหน้า</button><button className="primary-button icon-text-button" onClick={() => notify("ตัวอย่าง — การเพิ่มออเดอร์ยังไม่เปิดใช้งาน", "demo")}><Plus size={16} />เพิ่มออเดอร์</button></div>
        </div>
        <div className="order-filter-row" aria-label="กรองสถานะออเดอร์">{orderFilters.map((item) => <button key={item} className={orderFilter === item ? "active" : ""} onClick={() => setOrderFilter(item)}>{item}</button>)}</div>
        <div className="orders-table table-scroll">
          <div className="order-row order-head"><span>ออเดอร์</span><span>ลูกค้า</span><span>ช่องทาง</span><span>ยอดรวม</span><span>สถานะ</span><span>เวลา</span></div>
          {filteredOrders.map((order) => (
            <button className="order-row" key={order.id} onClick={() => notify(`ตัวอย่าง — หน้ารายละเอียดออเดอร์ ${order.id} ยังไม่เปิดใช้งาน`, "demo")}>
              <strong>{order.id}</strong><span>{order.customer}</span><span><i className={`channel-logo ${order.channelAccent}`}>{order.channel[0]}</i>{order.channel}</span><strong>{order.total}</strong><StatusPill tone={order.status === "ตรวจสอบ" ? "danger" : order.status === "จัดส่งแล้ว" ? "good" : "neutral"}>{order.status}</StatusPill><span>{order.time}</span>
            </button>
          ))}
        </div>
        {filteredOrders.length === 0 && <EmptyState title="ไม่พบออเดอร์" detail="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น" />}
      </section>
    </>
  );
}
