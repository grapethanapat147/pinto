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
import { OnboardingChecklist } from "./OnboardingChecklist";
import { ExampleTag, StatusPill } from "./StatusPill";
import { trendArrow } from "../format";
import type { DashboardMetrics, Notify, Payout, ShopAction, Trend, View } from "../types";

export function TodayView({ period, signedInAs, checklistClosed, actions, metrics, payouts, canSeeFinance, onOpenAction, onViewActions, onNavigate, notify }: { period: string; signedInAs: string; checklistClosed: boolean; actions: ShopAction[]; metrics: DashboardMetrics; payouts: Payout[]; canSeeFinance: boolean; onOpenAction: (action: ShopAction) => void; onViewActions: () => void; onNavigate: (view: View) => void; notify: Notify }) {
  const data = metrics.periods[period];
  const { asOf } = metrics;
  // "วันนี้" must not mean a day that has passed: if the last sync was earlier, name its day.
  const todayLabel = asOf.isToday ? "วันนี้" : asOf.day;
  const freshness = !asOf.synced ? "ยังไม่ได้ซิงก์" : asOf.isToday ? `อัปเดตล่าสุด ${asOf.time} น.` : `ข้อมูลถึง ${asOf.day} ${asOf.time} น.`;
  const comparedWith = period === "วันนี้" ? "จากช่วงเดียวกันเมื่อวาน" : "จากช่วงก่อนหน้า";
  const changeNote = (text: string, trend: Trend) => `${trendArrow(trend)} ${text} ${comparedWith}`;
  const tile = (key: string) => metrics.tiles.today?.find((item) => item.key === key);
  // The calendar shows the month the data is from (PIN-0030), laid out under the right weekday.
  const [year, month, anchorDay] = asOf.date.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, month - 1, 1));
  const leadingBlanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const calendarDays = Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, index) => index + 1);
  const payoutDays = new Set(payouts.filter((payout) => payout.expectedOn.startsWith(asOf.date.slice(0, 7))).map((payout) => Number(payout.expectedOn.slice(8, 10))));
  const [selectedDay, setSelectedDay] = useState(anchorDay);

  return (
    <>
      <section className="welcome-row">
        <div><h2>ยินดีต้อนรับกลับ {signedInAs}!</h2><p>ดูสุขภาพร้านและจัดการเรื่องสำคัญได้จากที่เดียว</p></div>
        {canSeeFinance && <button className="primary-button add-cost-button icon-text-button" onClick={() => onNavigate("stock")}><Plus size={17} />เพิ่มข้อมูลต้นทุน</button>}
      </section>

      {canSeeFinance && !checklistClosed && <OnboardingChecklist metrics={metrics} onNavigate={onNavigate} notify={notify} />}

      <div className="today-layout">
        <div className="today-main">
          <section className="overview-grid">
            <article className="panel sales-overview-card">
              <div className="sales-card-head">
                <div>
                  <p>กำไร{period === "วันนี้" ? (asOf.isToday ? "วันนี้" : ` ${asOf.day}`) : ` ${period}`}</p>
                  <h2>{data.profit} <small className={`delta delta-${data.changeTrend}`}>{trendArrow(data.changeTrend)} {data.change}</small></h2>
                  <small className="profit-basis">{data.partial ? `ต้นทุนครบ ${data.coverage} ของยอดขาย · ` : ""}ยังไม่รวมค่าธรรมเนียมและค่าส่ง</small>
                </div>
                <span>{freshness}</span>
              </div>
              <div className="sales-legend"><span><i className="profit-key" />กำไร</span><span><i className="cost-key" />ต้นทุนสินค้า</span></div>
              {/* weekly, from orders: only sixty days exist, so six months cannot be drawn (PIN-0030) */}
              <div className="paired-chart" aria-label="กราฟกำไรเทียบต้นทุนสินค้า รายสัปดาห์ 8 สัปดาห์ล่าสุด">
                {metrics.weekly.map((week) => (
                  <div className="paired-chart-group" key={week.label}>
                    <div><i style={{ height: `${week.profit}%` }} /><b style={{ height: `${week.cost}%` }} /></div>
                    <span>{week.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <div className="snapshot-stack" aria-label="ตัวเลขสำคัญ">
              <article className="snapshot-card"><span className="snapshot-icon"><BadgeDollarSign size={20} /></span><div><p>{tile("sales_note")?.label}</p><h3>{data.sales}</h3><small className={data.salesTrend === "down" ? "down" : "up"}>{changeNote(data.salesChange, data.salesTrend)}</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><PackageCheck size={20} /></span><div><p>{tile("orders_note")?.label}</p><h3>{data.orders}</h3><small className={data.ordersTrend === "down" ? "down" : "up"}>{changeNote(data.ordersChange, data.ordersTrend)}</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><Clock3 size={20} /></span><div><p>{tile("pending_payout")?.label}{tile("pending_payout")?.example && <> <ExampleTag /></>}</p><h3>{tile("pending_payout")?.value}</h3><small className="warning-text">{tile("pending_payout")?.note}</small></div></article>
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
              <button key={action.key} onClick={() => onOpenAction(action)}>
                <span className={`action-symbol ${action.tone}`}><ActionToneIcon tone={action.tone} /></span>
                <div><strong>{action.title}</strong><small>{action.channel} · {action.detail}</small></div>
                <b>{action.amount ?? ""}</b><i><ArrowRight size={16} /></i>
              </button>
            ))}</div> : <EmptyState title="จัดการครบแล้ว เก่งมาก!" detail="ตอนนี้ไม่มีเรื่องเร่งด่วนสำหรับร้านของคุณ" />}
          </section>

          <section className="panel channel-panel">
            <div className="panel-heading"><div><p>ช่องทางการขาย</p><h3>แต่ละช่องทางทำกำไรแค่ไหน</h3></div><small className="freshness">{todayLabel}{asOf.synced ? ` ถึง ${asOf.time} น.` : ""}</small></div>
            <div className="channel-table table-scroll">
              <div className="table-row table-head"><span>ช่องทาง</span><span>ยอดขาย</span><span>ออเดอร์</span><span>กำไร</span><span>อัตรากำไร</span></div>
              {metrics.channels.map((row) => (
                <div className="table-row" key={row.code}><span><i className={`channel-logo ${row.code}`}>{row.channel[0]}</i>{row.channel}</span><span>{row.sales}</span><span>{row.orders}</span><strong>{row.profit}</strong><StatusPill tone="good">{row.margin}</StatusPill></div>
              ))}
            </div>
            {metrics.channels.length === 0 && <EmptyState title="ยังไม่มีออเดอร์ในช่วงนี้" detail="เมื่อมีออเดอร์เข้ามา ยอดของแต่ละช่องทางจะแสดงที่นี่" />}
            <p className="profit-basis">กำไร = ยอดขาย − ต้นทุนสินค้า − ค่าโฆษณา{metrics.periods["วันนี้"].partial ? ` · ต้นทุนครบ ${metrics.periods["วันนี้"].coverage} ของยอดขาย` : ""} · ยังไม่รวมค่าธรรมเนียมและค่าส่ง</p>
          </section>
        </div>

        <aside className="right-rail">
          <section className="panel calendar-panel">
            <div className="calendar-head"><button aria-label="เดือนก่อนหน้า" onClick={() => notify("ตัวอย่าง — ปฏิทินแสดงเฉพาะเดือนของข้อมูลล่าสุด", "demo")}><ChevronLeft size={19} /></button><strong>{monthName}</strong><button aria-label="เดือนถัดไป" onClick={() => notify("ตัวอย่าง — ปฏิทินแสดงเฉพาะเดือนของข้อมูลล่าสุด", "demo")}><ChevronRight size={19} /></button></div>
            <div className="weekdays">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
              {calendarDays.map((day) => <button key={day} className={`${selectedDay === day ? "selected" : ""} ${payoutDays.has(day) ? "has-event" : ""}`} aria-label={payoutDays.has(day) ? `${day} — มีเงินเข้า` : undefined} onClick={() => setSelectedDay(day)}>{day}</button>)}
            </div>
            <button className="calendar-cta icon-text-button" onClick={() => notify(`ตัวอย่าง — กำหนดการวันที่ ${selectedDay} ยังไม่เปิดใช้งาน`, "demo")}><CalendarDays size={16} />ดูวันที่ {selectedDay} {monthName}</button>
          </section>

          {canSeeFinance && <section className="payout-schedule">
            <div className="rail-heading"><h3>เงินที่กำลังจะเข้า <ExampleTag /></h3><button className="icon-text-button" onClick={() => notify("ตัวอย่าง — หน้ากำหนดการรับเงินยังไม่เปิดใช้งาน", "demo")}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            {payouts.map((payout, index) => (
              <article key={payout.platform}><i className={`channel-logo ${payout.accent}`}>{payout.platform[0]}</i><div><strong>{payout.platform}</strong><span>{index === 0 ? "พรุ่งนี้" : payout.date} · {payout.orders}</span></div><b>{payout.amount}</b></article>
            ))}
          </section>}
        </aside>
      </div>
    </>
  );
}
