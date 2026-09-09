"use client";

import { ArrowRight, X } from "lucide-react";

import { navItems, viewTitles } from "../fixtures/navigation";
import type { View } from "../types";

export function MobileMoreSheet({ view, canSeeFinance, onChangeView, onClose }: { view: View; canSeeFinance: boolean; onChangeView: (view: View) => void; onClose: () => void }) {
  return (
    <div className="mobile-more-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="เมนูเพิ่มเติม">
        <header><div><p>เมนูเพิ่มเติม</p><strong>จัดการร้านได้ครบจากที่เดียว</strong></div><button onClick={onClose} aria-label="ปิดเมนู"><X size={20} /></button></header>
        <div>{navItems.slice(3).filter((item) => canSeeFinance || item.id !== "money").map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onChangeView(item.id)}><span><Icon size={21} /></span><div><strong>{item.label}</strong><small>{viewTitles[item.id].kicker}</small></div><ArrowRight size={17} /></button>;
        })}</div>
      </section>
    </div>
  );
}
