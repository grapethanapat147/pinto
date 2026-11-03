"use client";

import { ArrowRight, Sparkles, X } from "lucide-react";

import { ActionToneIcon } from "./ActionToneIcon";
import { StatusPill } from "./StatusPill";
import type { ShopAction } from "../types";

/**
 * One daily-brief card in full (PIN-0031): why, what skipping it costs, what to do, and what
 * data the rule read. No confidence figure — a rule has none, and the old "92%" was a literal.
 */
export function ActionDrawer({ action, onClose, onGo, onSnooze }: { action: ShopAction; onClose: () => void; onGo: () => void; onSnooze: () => void }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="action-drawer" role="dialog" aria-modal="true" aria-label={action.title}>
        <header><div><StatusPill tone={action.tone}>{action.urgent ? "ต้องทำวันนี้" : "ทำเมื่อสะดวก"}</StatusPill><span>{action.label} · {action.channel}</span></div><button onClick={onClose} aria-label="ปิดรายละเอียด"><X size={20} /></button></header>
        <div className={`drawer-icon ${action.tone}`}><ActionToneIcon tone={action.tone} size={23} /></div>
        <h2>{action.title}</h2><p className="drawer-detail">{action.detail}</p>
        {action.amount && <div className="impact-box"><span>ตัวเลขที่เกี่ยวข้อง</span><strong>{action.amount}</strong><small>{action.channel}</small></div>}
        <section><p className="drawer-label">ถ้าไม่ทำ</p><p>{action.consequence}</p></section>
        <section className="recommendation-box"><p className="drawer-label"><Sparkles size={16} />คำแนะนำ</p><p>{action.recommendation}</p></section>
        <section><p className="drawer-label">ข้อมูลที่ใช้</p><p>{action.basis}</p></section>
        <footer><button className="primary-button wide icon-text-button" onClick={onGo}>{action.cta.label} <ArrowRight size={16} /></button><button className="secondary-button wide" onClick={onSnooze}>ซ่อนถึงพรุ่งนี้</button><small>รายการนี้จะหายไปเองเมื่อข้อมูลไม่ตรงเงื่อนไขแล้ว</small></footer>
      </aside>
    </div>
  );
}
