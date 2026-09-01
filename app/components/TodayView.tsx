"use client";

import { useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Megaphone,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Plus,
} from "lucide-react";

import { ActionToneIcon } from "./ActionToneIcon";
import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { Notify, ShopAction, View } from "../types";

export function TodayView({ period, actions, onOpenAction, onViewActions, onNavigate, notify }: { period: string; actions: ShopAction[]; onOpenAction: (action: ShopAction) => void; onViewActions: () => void; onNavigate: (view: View) => void; notify: Notify }) {
  const periodData: Record<string, { profit: string; sales: string; ads: string; orders: string; change: string }> = {
    "วันนี้": { profit: "฿48,720", sales: "฿126,840", ads: "฿18,460", orders: "284", change: "12.4%" },
    "7 วัน": { profit: "฿286,940", sales: "฿782,560", ads: "฿109,280", orders: "1,842", change: "8.7%" },
    "30 วัน": { profit: "฿1,184,320", sales: "฿3,246,780", ads: "฿456,190", orders: "7,639", change: "16.2%" },
  };
  const data = periodData[period];
  const bars = [42, 76, 58, 88, 64, 82];
  const costs = [28, 44, 38, 52, 35, 46];
  const months = ["มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค."];
  const [selectedDay, setSelectedDay] = useState(25);
  const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <>
      <section className="welcome-row">
        <div><h2>ยินดีต้อนรับกลับ คุณมะลิ!</h2><p>ดูสุขภาพร้านและจัดการเรื่องสำคัญได้จากที่เดียว</p></div>
        <button className="primary-button add-cost-button icon-text-button" onClick={() => notify("เปิดหน้าจัดการต้นทุนสินค้า")}><Plus size={17} />เพิ่มข้อมูลต้นทุน</button>
      </section>

      <div className="today-layout">
        <div className="today-main">
          <section className="overview-grid">
            <article className="panel sales-overview-card">
              <div className="sales-card-head">
                <div><p>กำไร{period === "วันนี้" ? "วันนี้" : ` ${period}`}</p><h2>{data.profit} <StatusPill tone="good">↑ {data.change}</StatusPill></h2></div>
                <span>อัปเดตล่าสุด 10:42 น.</span>
              </div>
              <div className="sales-legend"><span><i className="profit-key" />กำไร</span><span><i className="cost-key" />ต้นทุนรวม</span></div>
              <div className="paired-chart" aria-label="กราฟเปรียบเทียบกำไรและต้นทุน 6 เดือน">
                {bars.map((bar, index) => (
                  <div className="paired-chart-group" key={months[index]}>
                    <div><i style={{ height: `${bar}%` }} /><b style={{ height: `${costs[index]}%` }} /></div>
                    <span>{months[index]}</span>
                  </div>
                ))}
              </div>
            </article>

            <div className="snapshot-stack" aria-label="ตัวเลขสำคัญ">
              <article className="snapshot-card"><span className="snapshot-icon"><BadgeDollarSign size={20} /></span><div><p>ยอดขายรวม</p><h3>{data.sales}</h3><small className="up">● 8.2% จากช่วงก่อน</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><PackageCheck size={20} /></span><div><p>ออเดอร์ทั้งหมด</p><h3>{data.orders}</h3><small className="up">● เพิ่มขึ้น 16 รายการ</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><Clock3 size={20} /></span><div><p>เงินรอโอน</p><h3>฿73,290</h3><small className="warning-text">● ภายใน 2–3 วัน</small></div></article>
            </div>
          </section>

          <section className="panel quick-work-panel">
            <div className="panel-heading"><div><p>งานร้านวันนี้</p><h3>ไปต่อได้ทันที ไม่ต้องไล่หาทีละเมนู</h3></div><small className="freshness">อัปเดตอัตโนมัติ</small></div>
            <div className="quick-work-grid">
              <button onClick={() => onNavigate("orders")}><span className="quick-work-icon orange"><PackageOpen size={20} /></span><div><strong>แพ็กออเดอร์</strong><small>47 รายการรอแพ็ก</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("inbox")}><span className="quick-work-icon blue"><MessageCircle size={20} /></span><div><strong>ตอบลูกค้า</strong><small>12 ข้อความรอตอบ</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("stock")}><span className="quick-work-icon amber"><Boxes size={20} /></span><div><strong>เติมสต๊อก</strong><small>6 รายการใกล้หมด</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("growth")}><span className="quick-work-icon green"><Megaphone size={20} /></span><div><strong>ดูแคมเปญ</strong><small>2 รายการควรปรับงบ</small></div><ArrowRight size={17} /></button>
            </div>
          </section>

          <section className="panel compact-action-panel">
            <div className="panel-heading"><div><p>Action Center</p><h3>เรื่องสำคัญที่ควรจัดการ</h3></div><button className="quiet-button icon-text-button" onClick={onViewActions}>ดูทั้งหมด <ArrowRight size={15} /></button></div>
            {actions.length > 0 ? <div className="compact-action-list">{actions.map((action) => (
              <button key={action.id} onClick={() => onOpenAction(action)}>
                <span className={`action-symbol ${action.tone}`}><ActionToneIcon tone={action.tone} /></span>
                <div><strong>{action.title}</strong><small>{action.channel} · {action.detail}</small></div>
                <b>{action.impact}</b><i><ArrowRight size={16} /></i>
              </button>
            ))}</div> : <EmptyState title="จัดการครบแล้ว เก่งมาก!" detail="ตอนนี้ไม่มีเรื่องเร่งด่วนสำหรับร้านของคุณ" />}
          </section>

          <section className="panel channel-panel">
            <div className="panel-heading"><div><p>ช่องทางการขาย</p><h3>แต่ละช่องทางทำกำไรแค่ไหน</h3></div><small className="freshness">ข้อมูลล่าสุด 10:42 น.</small></div>
            <div className="channel-table table-scroll">
              <div className="table-row table-head"><span>ช่องทาง</span><span>ยอดขาย</span><span>ออเดอร์</span><span>กำไร</span><span>อัตรากำไร</span></div>
              <div className="table-row"><span><i className="channel-logo tiktok">T</i>TikTok Shop</span><span>฿68,420</span><span>142</span><strong>฿24,930</strong><StatusPill tone="good">36.4%</StatusPill></div>
              <div className="table-row"><span><i className="channel-logo shopee">S</i>Shopee</span><span>฿42,180</span><span>96</span><strong>฿16,740</strong><StatusPill tone="good">39.7%</StatusPill></div>
              <div className="table-row"><span><i className="channel-logo line">L</i>LINE MyShop</span><span>฿16,240</span><span>46</span><strong>฿7,050</strong><StatusPill tone="good">43.4%</StatusPill></div>
            </div>
          </section>
        </div>

        <aside className="right-rail">
          <section className="panel calendar-panel">
            <div className="calendar-head"><button aria-label="เดือนก่อนหน้า"><ChevronLeft size={19} /></button><strong>สิงหาคม 2569</strong><button aria-label="เดือนถัดไป"><ChevronRight size={19} /></button></div>
            <div className="weekdays">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((day) => <button key={day} className={`${selectedDay === day ? "selected" : ""} ${[22, 26, 28].includes(day) ? "has-event" : ""}`} onClick={() => setSelectedDay(day)}>{day}</button>)}
            </div>
            <button className="calendar-cta icon-text-button" onClick={() => notify(`เปิดกำหนดการวันที่ ${selectedDay} สิงหาคม`)}><CalendarDays size={16} />ดูวันที่ {selectedDay} สิงหาคม</button>
          </section>

          <section className="payout-schedule">
            <div className="rail-heading"><h3>เงินที่กำลังจะเข้า</h3><button className="icon-text-button" onClick={() => notify("เปิดกำหนดการรับเงินทั้งหมด")}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            <article><i className="channel-logo tiktok">T</i><div><strong>TikTok Shop</strong><span>พรุ่งนี้ · 142 ออเดอร์</span></div><b>฿38,740</b></article>
            <article><i className="channel-logo shopee">S</i><div><strong>Shopee</strong><span>27 ส.ค. · 96 ออเดอร์</span></div><b>฿24,180</b></article>
            <article><i className="channel-logo line">L</i><div><strong>LINE MyShop</strong><span>28 ส.ค. · 31 ออเดอร์</span></div><b>฿10,370</b></article>
          </section>
        </aside>
      </div>
    </>
  );
}
