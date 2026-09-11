"use client";

import { LayoutGrid, LogOut, Sparkles } from "lucide-react";

import { PintoLogo } from "./PintoBrand";
import { navItems } from "../fixtures/navigation";
import type { Notify, View } from "../types";

/**
 * Up to two initials for the avatar, replacing the hard-coded "ML".
 *
 * Split by grapheme, not by code unit: a Thai name's first "letter" is often a cluster of
 * several code points, and slicing through one renders a broken glyph. A single-word name
 * therefore gets one initial rather than a mangled two.
 */
function initials(name: string): string {
  // "ร้าน" is the Thai word for shop, not part of the name — the seeded shop is
  // "ร้าน Mali Living", and taking it literally produced the avatar "ร้M".
  const words = name.trim().replace(/^ร้าน\s*/, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  const firstGrapheme = (word: string) => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(word)][0]?.segment ?? word.slice(0, 1);
  };

  if (words.length === 1) return firstGrapheme(words[0]).toUpperCase();
  return (firstGrapheme(words[0]) + firstGrapheme(words[1])).toUpperCase();
}

export function AppSidebar({ view, activeCount, mobileMenuOpen, signedInAs, shopName, canSeeFinance, onChangeView, onToggleMobileMenu, notify }: { view: View; activeCount: number; mobileMenuOpen: boolean; signedInAs: string; shopName: string; canSeeFinance: boolean; onChangeView: (view: View) => void; onToggleMobileMenu: () => void; notify: Notify }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onChangeView("today")} aria-label="กลับหน้าวันนี้">
        {/* Both marks ship; CSS picks one. The collapsed sidebar is 82px wide, too narrow
            for the wordmark to stay legible, so it falls back to the mark alone. */}
        <PintoLogo height={30} className="brand-lockup" />
        <PintoLogo markOnly width={34} className="brand-mark-only" />
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
        {navItems.slice(4).filter((item) => canSeeFinance || item.id !== "money").map((item) => {
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
        <div className="upgrade-card"><span><Sparkles size={16} strokeWidth={1.9} /></span><strong>ปลดล็อกข้อมูลเชิงลึก</strong><small>เชื่อมต้นทุนให้ครบ เพื่อเห็นกำไรที่แม่นยำขึ้น</small><button onClick={() => notify("ตัวอย่าง — หน้าตั้งค่าการเชื่อมต่อช่องทางยังไม่เปิดใช้งาน", "demo")}>จัดการการเชื่อมต่อ</button></div>
        <div className="store-card">
          <div className="store-avatar" aria-hidden="true">{initials(shopName)}</div>
          <div><strong>{shopName}</strong><small>{signedInAs}</small></div>
          <form method="post" action="/api/auth/logout">
            <button type="submit" aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut size={17} /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}
