"use client";

import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";

import { StatusPill } from "./StatusPill";
import { campaigns } from "../fixtures/campaigns";
import type { Notify } from "../types";

export function GrowthView({ notify }: { notify: Notify }) {
  return (
    <>
      <section className="compact-metrics growth-metrics">
        <article><p>ยอดขายจากโฆษณา</p><h3>฿61,450</h3><small className="up">↑ 11.6%</small></article>
        <article><p>ค่าโฆษณา</p><h3>฿18,460</h3><small className="down">↑ 4.1%</small></article>
        <article><p>ROAS รวม</p><h3>3.84</h3><small className="up">สูงกว่าเป้า 0.34</small></article>
        <article><p>กำไรจาก Ads</p><h3>฿21,720</h3><small className="up">Margin 35.3%</small></article>
      </section>
      <section className="growth-layout">
        <article className="panel data-panel campaign-panel">
          <div className="panel-heading"><div><p>แคมเปญโฆษณา</p><h3>ผลลัพธ์ตามกำไร ไม่ใช่แค่ยอดขาย</h3></div><button className="secondary-button icon-text-button" onClick={() => notify("ตัวอย่าง — ยังไม่ได้เชื่อมต่อบัญชีโฆษณา จึงไม่มีข้อมูลใหม่", "demo")}><RefreshCw size={15} />อัปเดต</button></div>
          <div className="campaign-table table-scroll">
            <div className="campaign-row campaign-head"><span>แคมเปญ</span><span>ใช้ไป</span><span>ยอดขาย</span><span>ROAS</span><span>สุขภาพ</span></div>
            {campaigns.map((campaign) => <button className="campaign-row" key={campaign.name} onClick={() => notify(`ตัวอย่าง — หน้ารายละเอียดแคมเปญ ${campaign.name} ยังไม่เปิดใช้งาน`, "demo")}><span><strong>{campaign.name}</strong><small>{campaign.channel}</small></span><span>{campaign.spend}</span><span>{campaign.revenue}</span><strong>{campaign.roas}</strong><StatusPill tone={campaign.health === "ดี" ? "good" : campaign.health === "ควรตรวจ" ? "danger" : "warning"}>{campaign.health}</StatusPill></button>)}
          </div>
        </article>
        <aside className="panel ai-panel">
          <span className="spark dark"><Sparkles size={20} /></span><p>Pinto แนะนำ</p><h3>โยกงบ ฿1,200 ไปที่ Ceramic Set</h3><p>แคมเปญนี้สร้างกำไรต่อบาทสูงกว่า Home Refresh 41% ในช่วง 3 วันที่ผ่านมา</p><div className="estimate-box"><span>กำไรที่อาจเพิ่ม</span><strong>+ ฿2,080 / วัน</strong></div><button className="primary-button wide" onClick={() => notify("ตัวอย่าง — แผนการปรับงบยังไม่เปิดใช้งาน จึงยังไม่ได้บันทึก", "demo")}>ดูแผนการปรับงบ</button><button className="quiet-button wide" onClick={() => notify("ตัวอย่าง — การเก็บคำแนะนำไว้ทีหลังยังไม่เปิดใช้งาน", "demo")}>ไว้ทีหลัง</button>
        </aside>
      </section>
      <section className="panel product-panel">
        <div className="panel-heading"><div><p>สินค้าที่กำลังมาแรง</p><h3>โอกาสเติบโตในสัปดาห์นี้</h3></div><button className="quiet-button icon-text-button" onClick={() => notify("ตัวอย่าง — หน้ารายการสินค้าทั้งหมดยังไม่เปิดใช้งาน", "demo")}>ดูสินค้าทั้งหมด <ArrowRight size={15} /></button></div>
        <div className="product-grid"><Product name="แจกันเซรามิกสีครีม" metric="ขายเพิ่ม 34%" profit="กำไร ฿8,420" color="cream" /><Product name="ชุดแก้ว Amber 4 ใบ" metric="ขายเพิ่ม 21%" profit="กำไร ฿6,190" color="amber" /><Product name="โคมไฟ Cloud" metric="ขายเพิ่ม 18%" profit="กำไร ฿4,870" color="blue" /></div>
      </section>
    </>
  );
}

function Product({ name, metric, profit, color }: { name: string; metric: string; profit: string; color: string }) {
  return <article className="product-item"><div className={`product-visual ${color}`}><i /></div><div><h4>{name}</h4><span className="up">↑ {metric}</span><small>{profit}</small></div></article>;
}
