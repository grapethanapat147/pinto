"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import { ActionToneIcon } from "./ActionToneIcon";
import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { ShopAction } from "../types";

/**
 * The daily brief (PIN-0031). The hero counts cards rather than summing their amounts: the
 * amounts are different kinds of fact (an order total, sales per day, a day's ad spend), and
 * adding them together would produce a number that means nothing.
 */
export function ActionsView({ actions, activeCount, urgentCount, filter, setFilter, onOpenAction }: { actions: ShopAction[]; activeCount: number; urgentCount: number; filter: string; setFilter: (value: string) => void; onOpenAction: (action: ShopAction) => void }) {
  const filters = ["ทั้งหมด", "ต้องทำวันนี้", "ทำเมื่อสะดวก"];
  return (
    <>
      <section className="action-hero panel">
        <div><span className="spark dark"><Sparkles size={20} /></span><div><p>สรุปโดย Pinto</p><h2>{activeCount > 0 ? `มี ${activeCount} เรื่องที่ควรจัดการ` : "วันนี้ไม่มีเรื่องที่ต้องจัดการแล้ว"}</h2><small>คำนวณจากออเดอร์ สต๊อก แชต และค่าโฆษณาของร้าน รายการจะหายไปเองเมื่อแก้แล้ว</small></div></div>
        <div className="impact-total"><span>ต้องทำวันนี้</span><strong>{urgentCount} เรื่อง</strong></div>
      </section>
      <div className="toolbar-row">
        <div className="filter-chips">
          {filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
      </div>
      {actions.length > 0 ? <div className="action-list">{actions.map((action) => (
        <button className={`action-list-item ${action.tone}`} key={action.key} onClick={() => onOpenAction(action)}>
          <i><ActionToneIcon tone={action.tone} size={19} /></i>
          <div><div className="action-list-meta"><StatusPill tone={action.tone}>{action.label}</StatusPill><span>{action.channel}</span><span>{action.urgent ? "ต้องทำวันนี้" : "ทำเมื่อสะดวก"}</span></div><h3>{action.title}</h3><p>{action.detail}</p></div>
          <strong>{action.amount ?? ""}</strong><span className="row-arrow"><ArrowRight size={17} /></span>
        </button>
      ))}</div> : <EmptyState title="ไม่พบรายการในหมวดนี้" detail="ลองเลือกตัวกรองอื่น หรือกลับมาตรวจอีกครั้งภายหลัง" />}
    </>
  );
}
