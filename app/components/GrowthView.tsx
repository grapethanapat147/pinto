"use client";

import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import type { Campaign, DashboardMetrics, Notify, RecommendationPanel } from "../types";

export function GrowthView({ campaigns, metrics, recommendation, notify }: { campaigns: Campaign[]; metrics: DashboardMetrics; recommendation?: RecommendationPanel; notify: Notify }) {
  const tiles = metrics.tiles.growth ?? [];

  return (
    <>
      <section className="compact-metrics growth-metrics">
        {tiles.map((tile) => (
          <article key={tile.key}><p>{tile.label}</p><h3 className={tile.trend === "warning" ? "text-warning" : undefined}>{tile.value}</h3><small className={tile.trend === "up" ? "up" : tile.trend === "down" ? "down" : undefined}>{tile.note}</small></article>
        ))}
      </section>
      <section className="growth-layout">
        <article className="panel data-panel campaign-panel">
          <div className="panel-heading"><div><p>แคมเปญโฆษณา</p><h3>ผลลัพธ์ตามกำไร ไม่ใช่แค่ยอดขาย</h3></div><button className="secondary-button icon-text-button" onClick={() => notify("ตัวอย่าง — ยังไม่ได้เชื่อมต่อบัญชีโฆษณา จึงไม่มีข้อมูลใหม่", "demo")}><RefreshCw size={15} />อัปเดต</button></div>
          <div className="campaign-table table-scroll">
            <div className="campaign-row campaign-head"><span>แคมเปญ</span><span>ใช้ไป</span><span>ยอดขาย</span><span>ROAS</span><span>สุขภาพ</span></div>
            {campaigns.map((campaign) => <button className="campaign-row" key={campaign.name} onClick={() => notify(`ตัวอย่าง — หน้ารายละเอียดแคมเปญ ${campaign.name} ยังไม่เปิดใช้งาน`, "demo")}><span><strong>{campaign.name}</strong><small>{campaign.channel}</small></span><span>{campaign.spend}</span><span>{campaign.revenue}</span><strong>{campaign.roas}</strong><StatusPill tone={campaign.health === "ดี" ? "good" : campaign.health === "ควรตรวจ" ? "danger" : "warning"}>{campaign.health}</StatusPill></button>)}
          </div>
          {campaigns.length === 0 && (
            <EmptyState title="ยังไม่มีแคมเปญ" detail="เชื่อมต่อบัญชีโฆษณาเพื่อดูผลลัพธ์ตามกำไร" />
          )}
        </article>
        <aside className="panel ai-panel">
          <span className="spark dark"><Sparkles size={20} /></span><p>{recommendation?.kicker}</p><h3>{recommendation?.title}</h3><p>{recommendation?.body}</p><div className="estimate-box"><span>{recommendation?.figureLabel}</span><strong>{recommendation?.figureValue}</strong></div><button className="primary-button wide" onClick={() => notify("ตัวอย่าง — แผนการปรับงบยังไม่เปิดใช้งาน จึงยังไม่ได้บันทึก", "demo")}>{recommendation?.cta}</button><button className="quiet-button wide" onClick={() => notify("ตัวอย่าง — การเก็บคำแนะนำไว้ทีหลังยังไม่เปิดใช้งาน", "demo")}>{recommendation?.secondaryCta}</button>
        </aside>
      </section>
      <section className="panel product-panel">
        <div className="panel-heading"><div><p>สินค้าที่กำลังมาแรง</p><h3>โอกาสเติบโตในสัปดาห์นี้</h3></div><button className="quiet-button icon-text-button" onClick={() => notify("ตัวอย่าง — หน้ารายการสินค้าทั้งหมดยังไม่เปิดใช้งาน", "demo")}>ดูสินค้าทั้งหมด <ArrowRight size={15} /></button></div>
        <div className="product-grid">{metrics.opportunities.map((item) => (
          <Product key={item.name} name={item.name} metric={item.metric} profit={item.profit} color={item.accent} />
        ))}</div>
      </section>
    </>
  );
}

function Product({ name, metric, profit, color }: { name: string; metric: string; profit: string; color: string }) {
  return <article className="product-item"><div className={`product-visual ${color}`}><i /></div><div><h4>{name}</h4><span className="up">↑ {metric}</span><small>{profit}</small></div></article>;
}
