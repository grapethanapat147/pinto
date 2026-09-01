"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import { ActionToneIcon } from "./ActionToneIcon";
import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { ShopAction } from "../types";

export function ActionsView({ actions, activeCount, filter, setFilter, onOpenAction }: { actions: ShopAction[]; activeCount: number; filter: string; setFilter: (value: string) => void; onOpenAction: (action: ShopAction) => void }) {
  const filters = ["ทั้งหมด", "ควรจัดการวันนี้", "ตรวจสอบออเดอร์", "โอกาสเพิ่มกำไร"];
  return (
    <>
      <section className="action-hero panel">
        <div><span className="spark dark"><Sparkles size={20} /></span><div><p>สรุปโดย Pinto</p><h2>{activeCount > 0 ? `มี ${activeCount} เรื่องที่ช่วยปกป้องกำไรได้วันนี้` : "วันนี้ไม่มีเรื่องเร่งด่วนแล้ว"}</h2><small>หากจัดการครบ คาดว่าจะรักษาหรือเพิ่มกำไรได้สูงสุด ฿22,990</small></div></div>
        <div className="impact-total"><span>ผลกระทบรวม</span><strong>฿22,990</strong></div>
      </section>
      <div className="toolbar-row">
        <div className="filter-chips">
          {filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <button className="secondary-button">เสร็จสิ้นแล้ว</button>
      </div>
      {actions.length > 0 ? <div className="action-list">{actions.map((action) => (
        <button className={`action-list-item ${action.tone}`} key={action.id} onClick={() => onOpenAction(action)}>
          <i><ActionToneIcon tone={action.tone} size={19} /></i>
          <div><div className="action-list-meta"><StatusPill tone={action.tone}>{action.label}</StatusPill><span>{action.channel}</span><span>{action.source}</span></div><h3>{action.title}</h3><p>{action.detail}</p></div>
          <strong>{action.impact}</strong><span className="row-arrow"><ArrowRight size={17} /></span>
        </button>
      ))}</div> : <EmptyState title="ไม่พบรายการในหมวดนี้" detail="ลองเลือกตัวกรองอื่น หรือกลับมาตรวจอีกครั้งภายหลัง" />}
    </>
  );
}
