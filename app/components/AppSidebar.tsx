"use client";

import { Ellipsis, LayoutGrid, Sparkles, Store } from "lucide-react";

import { navItems } from "../fixtures/navigation";
import type { Notify, View } from "../types";

export function AppSidebar({ view, activeCount, mobileMenuOpen, onChangeView, onToggleMobileMenu, notify }: { view: View; activeCount: number; mobileMenuOpen: boolean; onChangeView: (view: View) => void; onToggleMobileMenu: () => void; notify: Notify }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onChangeView("today")} aria-label="กลับหน้าวันนี้">
        <span><Store size={19} strokeWidth={2.2} /></span><span className="brand-copy"><strong>pinto</strong><small>Commerce Center</small></span>
      </button>
      <small className="nav-label">เมนูหลัก</small>
      <nav aria-label="เมนูหลัก">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
          <button
            className={`nav-item ${view === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => onChangeView(item.id)}
            aria-current={view === item.id ? "page" : undefined}
          >
            <span><Icon size={18} strokeWidth={1.8} /></span><em>{item.label}</em>
            {item.id === "actions" && activeCount > 0 && <b>{activeCount}</b>}
            {item.id === "inbox" && <b>7</b>}
          </button>
          );
        })}
      </nav>
      <small className="nav-label secondary-label">จัดการร้าน</small>
      <nav aria-label="เมนูจัดการร้าน">
        {navItems.slice(4).map((item) => {
          const Icon = item.icon;
          return (
          <button
            className={`nav-item ${view === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => onChangeView(item.id)}
            aria-current={view === item.id ? "page" : undefined}
          >
            <span><Icon size={18} strokeWidth={1.8} /></span><em>{item.label}</em>
          </button>
          );
        })}
      </nav>
      <button className={`mobile-more-button ${mobileMenuOpen ? "active" : ""}`} onClick={onToggleMobileMenu} aria-label="เปิดเมนูเพิ่มเติม" aria-expanded={mobileMenuOpen}>
        <span><LayoutGrid size={21} /></span><em>เพิ่มเติม</em>
      </button>
      <div className="sidebar-lower">
        <div className="upgrade-card"><span><Sparkles size={16} strokeWidth={1.9} /></span><strong>ปลดล็อกข้อมูลเชิงลึก</strong><small>เชื่อมต้นทุนให้ครบ เพื่อเห็นกำไรที่แม่นยำขึ้น</small><button onClick={() => notify("เปิดหน้าตั้งค่าการเชื่อมต่อ")}>จัดการการเชื่อมต่อ</button></div>
        <div className="store-card">
          <div className="store-avatar">ML</div>
          <div><strong>ร้าน Mali Living</strong><small>เชื่อมต่อแล้ว 3 ช่องทาง</small></div>
          <button aria-label="เปิดเมนูร้าน"><Ellipsis size={18} /></button>
        </div>
      </div>
    </aside>
  );
}
