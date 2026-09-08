"use client";

import { ArrowRight, Clock3, Crown, Repeat2, Sparkles } from "lucide-react";

import type { DashboardMetrics, Notify } from "../types";

const SEGMENT_ICON: Record<string, typeof Crown> = { best: Crown, repeat: Repeat2, sleeping: Clock3 };
const SEGMENT_CTA: Record<string, string> = { best: "ดูรายชื่อ", repeat: "ดูรายชื่อ", sleeping: "ดูแลกลุ่มนี้" };

export function CustomersView({ metrics, notify }: { metrics: DashboardMetrics; notify: Notify }) {
  return (
    <>
      <section className="customer-segments">
        {metrics.segments.map((segment) => {
          const Icon = SEGMENT_ICON[segment.key] ?? Crown;
          return (
            <article className={`segment-card ${segment.key}`} key={segment.key}>
              <div><span><Icon size={19} /></span><p>{segment.label}</p></div>
              <h3>{segment.count}</h3><small>{segment.note}</small>
              <button className="icon-text-button" onClick={() => notify(`ตัวอย่าง — รายชื่อ${segment.label}ยังไม่เปิดใช้งาน`, "demo")}>{SEGMENT_CTA[segment.key] ?? "ดูรายชื่อ"} <ArrowRight size={15} /></button>
            </article>
          );
        })}
      </section>
      <section className="customer-layout">
        <article className="panel region-panel">
          <div className="panel-heading"><div><p>พื้นที่ยอดนิยม</p><h3>ลูกค้าของคุณอยู่ที่ไหน</h3></div><button className="quiet-button" onClick={() => notify("ตัวอย่าง — หน้าพื้นที่ทั้งหมดยังไม่เปิดใช้งาน", "demo")}>ดูทั้งหมด</button></div>
          <div className="region-list">{metrics.regions.map((region) => (
            <Region key={region.name} name={region.name} value={region.value} width={region.width} />
          ))}</div>
        </article>
        <article className="panel customer-insight">
          <span className="spark dark"><Sparkles size={20} /></span><p>โอกาสดูแลลูกค้า</p><h3>ลูกค้า 82 คนพร้อมกลับมาซื้อซ้ำ</h3><p>กลุ่มนี้เคยซื้อ Home Living มากกว่า 2 ครั้ง และมีแนวโน้มตอบรับคูปองส่งฟรีสูง</p><div className="customer-value"><span>มูลค่าที่คาดการณ์</span><strong>฿46,700</strong></div><button className="primary-button wide" onClick={() => notify("ตัวอย่าง — การสร้างกลุ่มลูกค้ายังไม่เปิดใช้งาน", "demo")}>สร้างกลุ่มลูกค้า</button>
        </article>
      </section>
    </>
  );
}

function Region({ name, value, width }: { name: string; value: string; width: number }) {
  return <div><span>{name}</span><div><i style={{ width: `${width}%` }} /></div><strong>{value}</strong></div>;
}
