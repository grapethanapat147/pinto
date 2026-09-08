"use client";

import { ArrowRight, Check } from "lucide-react";

import { StatusPill } from "./StatusPill";
import type { Notify, Payout } from "../types";

export function MoneyView({ payouts, notify }: { payouts: Payout[]; notify: Notify }) {
  return (
    <>
      <section className="money-hero">
        <article><p>กำไรโดยประมาณวันนี้</p><h2>฿48,720</h2><StatusPill tone="good">↑ 12.4%</StatusPill><small>รวมข้อมูลครบ 98.6%</small></article>
        <article><p>เงินพร้อมถอน</p><h2>฿24,680</h2><button className="primary-button" onClick={() => notify("ตัวอย่าง — ยังไม่มีการถอนเงินจริง", "demo")}>ดูรายละเอียด</button></article>
        <article><p>เงินรอโอน</p><h2>฿73,290</h2><div className="mini-payout"><span>TikTok 53%</span><span>Shopee 33%</span><span>LINE 14%</span></div></article>
      </section>
      <section className="money-layout">
        <article className="panel waterfall-panel">
          <div className="panel-heading"><div><p>เส้นทางกำไรวันนี้</p><h3>ทุกบาทหายไปไหนบ้าง</h3></div><StatusPill tone="verified">ข้อมูล 98.6%</StatusPill></div>
          <div className="waterfall">
            <div className="waterfall-column"><i className="wf-sales" /><strong>฿126.8k</strong><span>ยอดขาย</span></div>
            <div className="waterfall-column"><i className="wf-cost" /><strong>−฿42.7k</strong><span>ต้นทุน</span></div>
            <div className="waterfall-column"><i className="wf-ads" /><strong>−฿18.5k</strong><span>โฆษณา</span></div>
            <div className="waterfall-column"><i className="wf-fees" /><strong>−฿17.0k</strong><span>ค่าธรรมเนียม</span></div>
            <div className="waterfall-column"><i className="wf-profit" /><strong>฿48.7k</strong><span>กำไร</span></div>
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
      </section>
    </>
  );
}
