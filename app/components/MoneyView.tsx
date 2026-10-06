"use client";

import { AlertTriangle, ArrowRight, Check } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import { trendArrow } from "../format";
import type { DashboardMetrics, Notify, Payout } from "../types";

export function MoneyView({ payouts, metrics, notify }: { payouts: Payout[]; metrics: DashboardMetrics; notify: Notify }) {
  const tile = (key: string) => metrics.tiles.money?.find((item) => item.key === key);
  const profit = tile("profit");
  const withdrawable = tile("withdrawable");
  const pending = tile("pending");
  const today = metrics.periods["วันนี้"];
  const todayLabel = metrics.asOf.isToday ? "วันนี้" : metrics.asOf.day;
  const missing = metrics.uncosted;

  return (
    <>
      <section className="money-hero">
        <article><p>{profit?.label}</p><h2>{profit?.value}</h2><small className={`delta delta-${today.changeTrend}`}>{trendArrow(today.changeTrend)} {today.change}</small><small>{profit?.note}</small></article>
        <article><p>{withdrawable?.label}</p><h2>{withdrawable?.value}</h2><button className="primary-button" onClick={() => notify("ตัวอย่าง — ยังไม่มีการถอนเงินจริง", "demo")}>ดูรายละเอียด</button></article>
        <article><p>{pending?.label}</p><h2>{pending?.value}</h2><div className="mini-payout">{(pending?.note ?? "").split(" · ").map((part) => <span key={part}>{part}</span>)}</div></article>
      </section>
      <section className="money-layout">
        <article className="panel waterfall-panel">
          <div className="panel-heading"><div><p>เส้นทางกำไร{todayLabel}</p><h3>ทุกบาทหายไปไหนบ้าง</h3></div><StatusPill tone={today.partial ? "warning" : "verified"}>ต้นทุนครบ {today.coverage}</StatusPill></div>
          <div className="waterfall">
            {metrics.waterfall.map((step) => (
              <div className="waterfall-column" key={step.kind}><i className={`wf-${step.kind}`} style={{ height: `${step.height}%` }} /><strong>{step.amount}</strong><span>{step.label}</span></div>
            ))}
          </div>
        </article>
        {/* What this profit leaves out, from the data rather than a promise (PIN-0027). */}
        {today.partial ? (
          <article className="panel money-note"><span className="spark dark"><AlertTriangle size={20} /></span><p>ข้อมูลยังไม่ครบ</p><h3>กำไรนี้ยังสูงกว่าความจริง</h3><p>สินค้า {missing.length} รายการยังไม่มีต้นทุน{missing.length > 0 ? ` (${missing.join(", ")})` : ""} จึงคิดต้นทุนได้ {today.coverage} ของยอดขาย และยังไม่รวมค่าธรรมเนียมกับค่าส่ง ซึ่งจะหักให้เมื่อเชื่อมต่อแพลตฟอร์มจริง</p><button className="quiet-button wide icon-text-button" onClick={() => notify("ตัวอย่าง — การแก้ต้นทุนสินค้ายังไม่เปิดใช้งาน", "demo")}>เพิ่มต้นทุนสินค้า <ArrowRight size={15} /></button></article>
        ) : (
          <article className="panel money-note"><span className="spark dark"><Check size={20} /></span><p>ต้นทุนครบทุกรายการ</p><h3>กำไรนี้คิดจากต้นทุนจริง</h3><p>ยังไม่รวมค่าธรรมเนียมกับค่าส่ง ซึ่งจะหักให้เมื่อเชื่อมต่อแพลตฟอร์มจริง</p></article>
        )}
      </section>
      <section className="panel payout-panel">
        <div className="panel-heading"><div><p>กำหนดการรับเงิน</p><h3>เงินที่แพลตฟอร์มกำลังจะโอน</h3></div><button className="secondary-button" onClick={() => notify("ตัวอย่าง — การดาวน์โหลดรายงานยังไม่เปิดใช้งาน", "demo")}>ดาวน์โหลดรายงาน</button></div>
        <div className="payout-table table-scroll">
          <div className="payout-row payout-head"><span>แพลตฟอร์ม</span><span>วันที่คาดว่าจะเข้า</span><span>รายการ</span><span>สถานะ</span><span>ยอดสุทธิ</span></div>
          {payouts.map((payout) => <div className="payout-row" key={payout.platform}><strong>{payout.platform}</strong><span>{payout.date}</span><span>{payout.orders}</span><StatusPill tone={payout.status === "ยืนยันแล้ว" ? "good" : "neutral"}>{payout.status}</StatusPill><strong>{payout.amount}</strong></div>)}
        </div>
        {payouts.length === 0 && (
          <EmptyState title="ยังไม่มีกำหนดการรับเงิน" detail="เมื่อแพลตฟอร์มยืนยันรอบโอน รายการจะแสดงที่นี่" />
        )}
      </section>
    </>
  );
}
