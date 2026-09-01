"use client";

import { Sparkles, X } from "lucide-react";

import { ActionToneIcon } from "./ActionToneIcon";
import { StatusPill } from "./StatusPill";
import type { Notify, ShopAction } from "../types";

export function ActionDrawer({ action, onClose, onResolve, notify }: { action: ShopAction; onClose: () => void; onResolve: () => void; notify: Notify }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="action-drawer" role="dialog" aria-modal="true" aria-label={action.title}>
        <header><div><StatusPill tone={action.tone}>{action.label}</StatusPill><span>{action.source}</span></div><button onClick={onClose} aria-label="ปิดรายละเอียด"><X size={20} /></button></header>
        <div className={`drawer-icon ${action.tone}`}><ActionToneIcon tone={action.tone} size={23} /></div>
        <h2>{action.title}</h2><p className="drawer-detail">{action.detail}</p>
        <div className="impact-box"><span>ผลกระทบที่ประเมิน</span><strong>{action.impact}</strong><small>{action.channel}</small></div>
        <section><p className="drawer-label">สิ่งที่ Pinto พบ</p><p>{action.insight}</p></section>
        <section className="recommendation-box"><p className="drawer-label"><Sparkles size={16} />คำแนะนำ</p><p>{action.recommendation}</p></section>
        <div className="confidence"><span>ความมั่นใจของคำแนะนำ</span><div><i /></div><strong>92%</strong></div>
        <footer><button className="primary-button wide" onClick={onResolve}>อนุมัติและทำเครื่องหมายว่าเสร็จ</button><button className="secondary-button wide" onClick={() => { onClose(); notify("เก็บรายการไว้จัดการภายหลัง"); }}>ไว้ทีหลัง</button><small>ตัวอย่างนี้จะไม่เปลี่ยนแปลงข้อมูลบนแพลตฟอร์มจริง</small></footer>
      </aside>
    </div>
  );
}
