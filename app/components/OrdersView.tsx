"use client";

import { useState } from "react";
import { Plus, Search, Truck } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { Notify, Order } from "../types";

export function OrdersView({ query, setQuery, orders: visibleOrders, notify }: { query: string; setQuery: (value: string) => void; orders: Order[]; notify: Notify }) {
  const [orderFilter, setOrderFilter] = useState("ทั้งหมด");
  const orderFilters = ["ทั้งหมด", "รอแพ็ก", "พร้อมส่ง", "ตรวจสอบ", "จัดส่งแล้ว"];
  const filteredOrders = orderFilter === "ทั้งหมด" ? visibleOrders : visibleOrders.filter((order) => order.status === orderFilter);
  return (
    <>
      <section className="order-metrics compact-metrics">
        <article><p>ออเดอร์ใหม่</p><h3>284</h3><small className="up">↑ 6.0% จากเมื่อวาน</small></article>
        <article><p>รอแพ็ก</p><h3>47</h3><small>ควรเสร็จก่อน 14:00 น.</small></article>
        <article><p>ต้องตรวจสอบ</p><h3 className="text-warning">8</h3><small>มีความเสี่ยงผิดปกติ</small></article>
        <article><p>จัดส่งสำเร็จ</p><h3>229</h3><small className="up">อัตราสำเร็จ 97.2%</small></article>
      </section>
      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="search-box"><span><Search size={18} /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาออเดอร์หรือลูกค้า" aria-label="ค้นหาออเดอร์" /></div>
          <div><button className="secondary-button icon-text-button" onClick={() => notify("เตรียมใบปะหน้า 47 รายการแล้ว")}><Truck size={16} />พิมพ์ใบปะหน้า</button><button className="primary-button icon-text-button" onClick={() => notify("นำเข้าข้อมูลตัวอย่างเรียบร้อย")}><Plus size={16} />เพิ่มออเดอร์</button></div>
        </div>
        <div className="order-filter-row" aria-label="กรองสถานะออเดอร์">{orderFilters.map((item) => <button key={item} className={orderFilter === item ? "active" : ""} onClick={() => setOrderFilter(item)}>{item}</button>)}</div>
        <div className="orders-table table-scroll">
          <div className="order-row order-head"><span>ออเดอร์</span><span>ลูกค้า</span><span>ช่องทาง</span><span>ยอดรวม</span><span>สถานะ</span><span>เวลา</span></div>
          {filteredOrders.map((order) => (
            <button className="order-row" key={order.id} onClick={() => notify(`เปิดออเดอร์ ${order.id}`)}>
              <strong>{order.id}</strong><span>{order.customer}</span><span><i className={`channel-logo ${order.channel.toLowerCase()}`}>{order.channel[0]}</i>{order.channel}</span><strong>{order.total}</strong><StatusPill tone={order.status === "ตรวจสอบ" ? "danger" : order.status === "จัดส่งแล้ว" ? "good" : "neutral"}>{order.status}</StatusPill><span>{order.time}</span>
            </button>
          ))}
        </div>
        {filteredOrders.length === 0 && <EmptyState title="ไม่พบออเดอร์" detail="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น" />}
      </section>
    </>
  );
}
