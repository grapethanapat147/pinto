"use client";

import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";

import type { DashboardMetrics, Notify, View } from "../types";

/**
 * The new-seller checklist (PIN-0032, spec `.codex/specs/daily-brief.md` Q7). Every tick is read
 * from data already on the page — a channel has synced; the last 30 days' revenue is fully
 * costed — so nothing can be ticked that is not true. The only thing stored is "ปิด".
 *
 * It disappears once the first two steps are done: the third is the reward they unlock, and
 * the Money view it points at is already in the menu.
 */
export function OnboardingChecklist({ metrics, onNavigate, notify }: { metrics: DashboardMetrics; onNavigate: (view: View) => void; notify: Notify }) {
  const [closed, setClosed] = useState(false);
  const connected = metrics.asOf.synced;
  const costed = !metrics.periods["30 วัน"]?.partial;
  if (closed || (connected && costed)) return null;

  async function close() {
    try {
      const response = await fetch("/api/actions/snooze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "checklist:onboarding" }),
      });
      if (!response.ok) {
        notify("ปิดไม่สำเร็จ ลองใหม่อีกครั้ง", "demo");
        return;
      }
      setClosed(true);
    } catch {
      notify("เชื่อมต่อไม่ได้ จึงยังไม่ได้ปิด", "demo");
    }
  }

  const steps = [
    { done: connected, title: "เชื่อมช่องทางขายอย่างน้อย 1 ช่องทาง", cta: "ไปที่การเชื่อมต่อ", view: "connections" as View },
    { done: costed, title: "ใส่ต้นทุนครบทุกสินค้า", cta: "ใส่ต้นทุน", view: "stock" as View },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section className="panel onboarding-panel" aria-labelledby="onboarding-title">
      <div className="panel-heading">
        <div><p>เริ่มต้นใช้ Pinto · ทำแล้ว {doneCount} จาก {steps.length} ขั้น</p><h3 id="onboarding-title">อีกนิดเดียวก็เห็นกำไรจริงของร้าน</h3></div>
        <button className="onboarding-close" onClick={() => { void close(); }} aria-label="ปิดรายการเริ่มต้นใช้งาน"><X size={18} /></button>
      </div>
      <ol className="onboarding-steps">
        {steps.map((step) => (
          <li key={step.title} className={step.done ? "done" : undefined}>
            <span className="onboarding-tick" aria-hidden="true">{step.done ? <Check size={15} /> : null}</span>
            <strong>{step.title}</strong>
            {step.done ? <small>เสร็จแล้ว</small> : <button className="quiet-button icon-text-button" onClick={() => onNavigate(step.view)}>{step.cta} <ArrowRight size={15} /></button>}
          </li>
        ))}
        <li className="locked">
          <span className="onboarding-tick" aria-hidden="true" />
          <strong>ดูกำไรจริง</strong>
          <small>เปิดได้เมื่อทำ 2 ขั้นแรกครบ</small>
        </li>
      </ol>
    </section>
  );
}
