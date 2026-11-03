"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Sparkles } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { StatusPill } from "./StatusPill";
import { formatBaht } from "../format";
import type { ChannelSyncRow, DashboardMetrics, InventoryItem, Notify, RecommendationPanel } from "../types";

/**
 * Cost per unit, edited in place (PIN-0028). Only rendered for owners — and for staff the
 * `cost` field is not in the payload at all, so there is nothing to hide.
 *
 * A product's first cost may also fill the past order lines that had none (spec Q8); the
 * checkbox appears only then, says how many lines it touches, and starts ticked because that
 * is what someone entering a missing cost expects.
 */
function CostCell({ item, notify }: { item: InventoryItem; notify: Notify }) {
  const router = useRouter();
  const cost = item.cost!;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cost.unitCostSatang === null ? "" : String(cost.unitCostSatang / 100));
  const [fillPast, setFillPast] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canFill = cost.unitCostSatang === null && cost.uncostedLines > 0;
  const input = useRef<HTMLInputElement>(null);
  // move focus into the field the owner just asked to edit, and only then
  useEffect(() => {
    if (!editing) return;
    // centre it in the scrolling table: a plain focus() can leave it under the pinned name column
    input.current?.focus({ preventScroll: true });
    input.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [editing]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(item.sku)}/cost`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost: value, ...(canFill ? { fillPast } : {}) }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; filled?: number };
      if (!response.ok) {
        setError(result.error ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setEditing(false);
      notify(result.filled ? `บันทึกต้นทุนแล้ว และเติมให้ออเดอร์เก่า ${result.filled.toLocaleString("en-US")} รายการ` : "บันทึกต้นทุนแล้ว");
      // profit, coverage and the brief all read this cost, so fetch the page's data again
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ จึงยังไม่ได้บันทึก");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="cost-cell">
        {cost.unitCostSatang === null ? <small className="warning-text">ยังไม่มี</small> : <strong>{formatBaht(cost.unitCostSatang)}</strong>}
        <button className="quiet-button" onClick={() => setEditing(true)} aria-label={`แก้ต้นทุนของ ${item.name}`}>{cost.unitCostSatang === null ? "ใส่ต้นทุน" : "แก้"}</button>
      </span>
    );
  }

  return (
    <form className="cost-cell editing" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label><span className="visually-hidden">ต้นทุนต่อชิ้นของ {item.name} (บาท)</span><input ref={input} value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="บาท" aria-invalid={error ? true : undefined} /></label>
      {canFill && <label className="cost-fill"><input type="checkbox" checked={fillPast} onChange={(event) => setFillPast(event.target.checked)} />ใช้กับออเดอร์เก่าที่ยังไม่มีต้นทุน ({cost.uncostedLines.toLocaleString("en-US")} รายการ)</label>}
      <div><button className="primary-button" type="submit" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button><button className="secondary-button" type="button" onClick={() => { setEditing(false); setError(""); }}>ยกเลิก</button></div>
      {error && <small className="cost-error" role="alert">{error}</small>}
    </form>
  );
}

export function StockView({ inventory, metrics, channelSync, recommendation, notify }: { inventory: InventoryItem[]; metrics: DashboardMetrics; channelSync: ChannelSyncRow[]; recommendation?: RecommendationPanel; notify: Notify }) {
  const showCost = inventory.some((item) => item.cost);
  const tiles = metrics.tiles.stock ?? [];
  const [stockFilter, setStockFilter] = useState("ทั้งหมด");
  const stockFilters = ["ทั้งหมด", "ใกล้หมด", "หมดสต๊อก", "พร้อมขาย"];
  const visibleInventory = stockFilter === "ทั้งหมด" ? inventory : inventory.filter((item) => item.status === stockFilter);

  return (
    <>
      <section className="compact-metrics stock-metrics">
        {tiles.map((tile) => (
          <article key={tile.key}><p>{tile.label}</p><h3 className={tile.trend === "warning" ? "text-warning" : undefined}>{tile.value}</h3><small className={tile.trend === "up" ? "up" : tile.trend === "down" ? "down" : undefined}>{tile.note}</small></article>
        ))}
      </section>

      <section className="stock-layout">
        <article className="panel data-panel stock-panel">
          <div className="panel-heading stock-heading"><div><p>สต๊อกทุกช่องทาง</p><h3>รู้จำนวนจริงก่อนรับออเดอร์เพิ่ม</h3></div><button className="primary-button icon-text-button" onClick={() => notify("ตัวอย่าง — การสร้างใบสั่งซื้อยังไม่เปิดใช้งาน", "demo")}><ShoppingCart size={16} />สร้างใบสั่งซื้อ</button></div>
          <div className="order-filter-row" aria-label="กรองสถานะสต๊อก">{stockFilters.map((item) => <button key={item} className={stockFilter === item ? "active" : ""} onClick={() => setStockFilter(item)}>{item}</button>)}</div>
          <div className={`stock-table table-scroll${showCost ? " with-cost" : ""}`}>
            <div className="stock-row stock-head"><span>สินค้า</span><span>คงเหลือ</span><span>จองแล้ว</span><span>ขายได้อีก</span>{showCost && <span>ต้นทุน/ชิ้น</span>}<span>ซิงก์ช่องทาง</span><span>สถานะ</span></div>
            {visibleInventory.map((item) => (
              <div className="stock-row" key={item.sku}>
                <span><strong>{item.name}</strong><small>{item.sku} · {item.category}</small></span>
                <strong>{item.stock}</strong><span>{item.reserved}</span><span>{item.daysLeft === null || item.stock <= 0 ? "—" : item.daysLeft < 1 ? "ไม่ถึง 1 วัน" : `${item.daysLeft} วัน`}</span>{showCost && <CostCell item={item} notify={notify} />}<span>{item.sync}</span>
                <StatusPill tone={item.status === "พร้อมขาย" ? "good" : item.status === "ใกล้หมด" ? "warning" : "danger"}>{item.status}</StatusPill>
              </div>
            ))}
          </div>
          {visibleInventory.length === 0 && (
            <EmptyState title="ไม่พบสินค้าในหมวดนี้" detail="ลองเลือกตัวกรองอื่น หรือเพิ่มสินค้าเข้าระบบ" />
          )}
        </article>

        <aside className="panel stock-insight">
          <span className="spark dark"><Sparkles size={20} /></span><p>{recommendation?.kicker}</p><h3>{recommendation?.title}</h3><p>{recommendation?.body}</p>
          <div className="restock-list">{metrics.restock.map((item) => (
            <div key={item.name}><span>{item.name}</span><strong>{item.quantity}</strong></div>
          ))}</div>
          <button className="primary-button wide" onClick={() => notify("ตัวอย่าง — ใบสั่งซื้อยังไม่เปิดใช้งาน จึงยังไม่ได้เพิ่มสินค้า", "demo")}>{recommendation?.cta}</button>
        </aside>
      </section>

      <section className="channel-sync-grid" aria-label="สถานะการเชื่อมต่อสต๊อก">
        {channelSync.map((row) => (
          <article key={row.code}>
            <i className={`channel-logo ${row.accent}`}>{row.displayName[0]}</i>
            <div><strong>{row.displayName}</strong><span>{row.detail}</span></div>
            <StatusPill tone={row.tone}>{row.label}</StatusPill>
          </article>
        ))}
      </section>
    </>
  );
}
