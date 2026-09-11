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
import type { DashboardMetrics, Notify, Payout, ShopAction, View } from "../types";

export function TodayView({ period, actions, metrics, payouts, canSeeFinance, onOpenAction, onViewActions, onNavigate, notify }: { period: string; actions: ShopAction[]; metrics: DashboardMetrics; payouts: Payout[]; canSeeFinance: boolean; onOpenAction: (action: ShopAction) => void; onViewActions: () => void; onNavigate: (view: View) => void; notify: Notify }) {
  const data = metrics.periods[period] ?? { profit: "", sales: "", ads: "", orders: "", change: "" };
  const tile = (key: string) => metrics.tiles.today?.find((item) => item.key === key);
  const bars = [42, 76, 58, 88, 64, 82];
  const costs = [28, 44, 38, 52, 35, 46];
  const months = ["มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค."];
  const [selectedDay, setSelectedDay] = useState(25);
  const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <>
      <section className="welcome-row">
        <div><h2>ยินดีต้อนรับกลับ คุณมะลิ!</h2><p>ดูสุขภาพร้านและจัดการเรื่องสำคัญได้จากที่เดียว</p></div>
        <button className="primary-button add-cost-button icon-text-button" onClick={() => notify("ตัวอย่าง — หน้าจัดการต้นทุนสินค้ายังไม่เปิดใช้งาน", "demo")}><Plus size={17} />เพิ่มข้อมูลต้นทุน</button>
      </section>

      <div className="today-layout">
        <div className="today-main">
          <section className="overview-grid">
            <article className="panel sales-overview-card">
              <div className="sales-card-head">
                <div><p>กำไร{period === "วันนี้" ? "วันนี้" : ` ${period}`}</p><h2>{data.profit} <small className="delta delta-up">↑ {data.change}</small></h2></div>
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
              <article className="snapshot-card"><span className="snapshot-icon"><BadgeDollarSign size={20} /></span><div><p>{tile("sales_note")?.label}</p><h3>{data.sales}</h3><small className="up">{tile("sales_note")?.note}</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><PackageCheck size={20} /></span><div><p>{tile("orders_note")?.label}</p><h3>{data.orders}</h3><small className="up">{tile("orders_note")?.note}</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><Clock3 size={20} /></span><div><p>{tile("pending_payout")?.label}</p><h3>{tile("pending_payout")?.value}</h3><small className="warning-text">{tile("pending_payout")?.note}</small></div></article>
            </div>
          </section>

          <section className="panel quick-work-panel">
            <div className="panel-heading"><div><p>งานร้านวันนี้</p><h3>ไปต่อได้ทันที ไม่ต้องไล่หาทีละเมนู</h3></div><small className="freshness">อัปเดตอัตโนมัติ</small></div>
            <div className="quick-work-grid">
              <button onClick={() => onNavigate("orders")}><span className="quick-work-icon orange"><PackageOpen size={20} /></span><div><strong>{tile("quick_pack")?.label}</strong><small>{tile("quick_pack")?.note}</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("inbox")}><span className="quick-work-icon blue"><MessageCircle size={20} /></span><div><strong>{tile("quick_reply")?.label}</strong><small>{tile("quick_reply")?.note}</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("stock")}><span className="quick-work-icon amber"><Boxes size={20} /></span><div><strong>{tile("quick_restock")?.label}</strong><small>{tile("quick_restock")?.note}</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("growth")}><span className="quick-work-icon green"><Megaphone size={20} /></span><div><strong>{tile("quick_campaign")?.label}</strong><small>{tile("quick_campaign")?.note}</small></div><ArrowRight size={17} /></button>
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
              {metrics.channels.map((row) => (
                <div className="table-row" key={row.code}><span><i className={`channel-logo ${row.code}`}>{row.channel[0]}</i>{row.channel}</span><span>{row.sales}</span><span>{row.orders}</span><strong>{row.profit}</strong><StatusPill tone="good">{row.margin}</StatusPill></div>
              ))}
            </div>
          </section>
        </div>

        <aside className="right-rail">
          <section className="panel calendar-panel">
            <div className="calendar-head"><button aria-label="เดือนก่อนหน้า" onClick={() => notify("ตัวอย่าง — ปฏิทินเดโมมีเฉพาะสิงหาคม 2569", "demo")}><ChevronLeft size={19} /></button><strong>สิงหาคม 2569</strong><button aria-label="เดือนถัดไป" onClick={() => notify("ตัวอย่าง — ปฏิทินเดโมมีเฉพาะสิงหาคม 2569", "demo")}><ChevronRight size={19} /></button></div>
            <div className="weekdays">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((day) => <button key={day} className={`${selectedDay === day ? "selected" : ""} ${[22, 26, 28].includes(day) ? "has-event" : ""}`} onClick={() => setSelectedDay(day)}>{day}</button>)}
            </div>
            <button className="calendar-cta icon-text-button" onClick={() => notify(`ตัวอย่าง — กำหนดการวันที่ ${selectedDay} สิงหาคม ยังไม่เปิดใช้งาน`, "demo")}><CalendarDays size={16} />ดูวันที่ {selectedDay} สิงหาคม</button>
          </section>

          {canSeeFinance && <section className="payout-schedule">
            <div className="rail-heading"><h3>เงินที่กำลังจะเข้า</h3><button className="icon-text-button" onClick={() => notify("ตัวอย่าง — หน้ากำหนดการรับเงินยังไม่เปิดใช้งาน", "demo")}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            {payouts.map((payout, index) => (
              <article key={payout.platform}><i className={`channel-logo ${payout.accent}`}>{payout.platform[0]}</i><div><strong>{payout.platform}</strong><span>{index === 0 ? "พรุ่งนี้" : payout.date} · {payout.orders}</span></div><b>{payout.amount}</b></article>
            ))}
          </section>}
        </aside>
      </div>
    </>
  );
}
