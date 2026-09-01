"use client";

import { ArrowRight, Clock3, Crown, Repeat2, Sparkles } from "lucide-react";

import type { Notify } from "../types";

export function CustomersView({ notify }: { notify: Notify }) {
  return (
    <>
      <section className="customer-segments">
        <article className="segment-card best"><div><span><Crown size={19} /></span><p>ลูกค้าคนสำคัญ</p></div><h3>286 คน</h3><small>สร้าง 42% ของรายได้ทั้งหมด</small><button className="icon-text-button" onClick={() => notify("เปิดรายชื่อลูกค้าคนสำคัญ")}>ดูรายชื่อ <ArrowRight size={15} /></button></article>
        <article className="segment-card repeat"><div><span><Repeat2 size={19} /></span><p>ลูกค้าซื้อซ้ำ</p></div><h3>1,148 คน</h3><small>อัตราซื้อซ้ำ 29.8%</small><button className="icon-text-button" onClick={() => notify("เปิดกลุ่มลูกค้าซื้อซ้ำ")}>ดูรายชื่อ <ArrowRight size={15} /></button></article>
        <article className="segment-card sleeping"><div><span><Clock3 size={19} /></span><p>กำลังจะหายไป</p></div><h3>194 คน</h3><small>ไม่ได้ซื้อสินค้านานกว่า 60 วัน</small><button className="icon-text-button" onClick={() => notify("เปิดกลุ่มลูกค้าที่ควรดูแล")}>ดูแลกลุ่มนี้ <ArrowRight size={15} /></button></article>
      </section>
      <section className="customer-layout">
        <article className="panel region-panel">
          <div className="panel-heading"><div><p>พื้นที่ยอดนิยม</p><h3>ลูกค้าของคุณอยู่ที่ไหน</h3></div><button className="quiet-button">ดูทั้งหมด</button></div>
          <div className="region-list"><Region name="กรุงเทพมหานคร" value="32%" width={100} /><Region name="ชลบุรี" value="12%" width={38} /><Region name="เชียงใหม่" value="9%" width={28} /><Region name="นครราชสีมา" value="7%" width={22} /><Region name="ขอนแก่น" value="6%" width={19} /></div>
        </article>
        <article className="panel customer-insight">
          <span className="spark dark"><Sparkles size={20} /></span><p>โอกาสดูแลลูกค้า</p><h3>ลูกค้า 82 คนพร้อมกลับมาซื้อซ้ำ</h3><p>กลุ่มนี้เคยซื้อ Home Living มากกว่า 2 ครั้ง และมีแนวโน้มตอบรับคูปองส่งฟรีสูง</p><div className="customer-value"><span>มูลค่าที่คาดการณ์</span><strong>฿46,700</strong></div><button className="primary-button wide" onClick={() => notify("สร้างกลุ่มลูกค้าไว้แล้ว")}>สร้างกลุ่มลูกค้า</button>
        </article>
      </section>
    </>
  );
}

function Region({ name, value, width }: { name: string; value: string; width: number }) {
  return <div><span>{name}</span><div><i style={{ width: `${width}%` }} /></div><strong>{value}</strong></div>;
}
