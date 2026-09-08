"use client";

import { ArrowRight, Check } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { DashboardMetrics, Notify, Payout } from "../types";

export function MoneyView({ payouts, metrics, notify }: { payouts: Payout[]; metrics: DashboardMetrics; notify: Notify }) {
  const tile = (key: string) => metrics.tiles.money?.find((item) => item.key === key);
  const profit = tile("profit");
  const withdrawable = tile("withdrawable");
  const pending = tile("pending");

  return (
    <>
      <section className="money-hero">
        <article><p>{profit?.label}</p><h2>{profit?.value}</h2><StatusPill tone="good">↑ 12.4%</StatusPill><small>{profit?.note}</small></article>
        <article><p>{withdrawable?.label}</p><h2>{withdrawable?.value}</h2><button className="primary-button" onClick={() => notify("ตัวอย่าง — ยังไม่มีการถอนเงินจริง", "demo")}>ดูรายละเอียด</button></article>
        <article><p>{pending?.label}</p><h2>{pending?.value}</h2><div className="mini-payout">{(pending?.note ?? "").split(" · ").map((part) => <span key={part}>{part}</span>)}</div></article>
      </section>
      <section className="money-layout">
        <article className="panel waterfall-panel">
          <div className="panel-heading"><div><p>เส้นทางกำไรวันนี้</p><h3>ทุกบาทหายไปไหนบ้าง</h3></div><StatusPill tone="verified">ข้อมูล 98.6%</StatusPill></div>
          <div className="waterfall">
            {metrics.waterfall.map((step) => (
              <div className="waterfall-column" key={step.kind}><i className={`wf-${step.kind}`} /><strong>{step.amount}</strong><span>{step.label}</span></div>
            ))}
          </div>
        </article>
        <article className="panel money-note"><span className="spark dark"><Check size={20} /></span><p>ตรวจสอบข้อมูลแล้ว</p><h3>ตัวเลขใกล้ครบทั้งหมด</h3><p>มีเพียง 4 ออเดอร์ที่รอค่าขนส่งจริง ระบบจะปรับกำไรให้อัตโนมัติเมื่อข้อมูลเข้ามา</p><button className="quiet-button wide icon-text-button" onClick={() => notify("ตัวอย่าง — รายการที่รอตรวจสอบยังไม่เปิดใช้งาน", "demo")}>ดู 4 รายการ <ArrowRight size={15} /></button></article>
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
