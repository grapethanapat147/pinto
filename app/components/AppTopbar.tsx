"use client";

import { Bell, Home as HomeIcon } from "lucide-react";

import { StatusPill } from "./StatusPill";
import { viewTitles } from "../fixtures/navigation";
import type { Notify, View } from "../types";

export function AppTopbar({ view, period, activeCount, onChangePeriod, onOpenActions, notify }: { view: View; period: string; activeCount: number; onChangePeriod: (period: string) => void; onOpenActions: () => void; notify: Notify }) {
  return (
    <header className="topbar">
      <div>
        <div className="kicker-row"><p>{viewTitles[view].kicker}</p><StatusPill tone="demo">ข้อมูลจำลอง</StatusPill></div>
        <h1><HomeIcon className="home-mark" size={18} strokeWidth={1.9} />{viewTitles[view].title}</h1>
      </div>
      <div className="top-actions">
        {view === "today" && (
          <div className="period-tabs" aria-label="เลือกช่วงเวลา">
            {["วันนี้", "7 วัน", "30 วัน"].map((item) => (
              <button key={item} className={period === item ? "active" : ""} onClick={() => { onChangePeriod(item); notify(`เปลี่ยนมุมมองเป็น ${item}`); }}>{item}</button>
            ))}
          </div>
        )}
        <button className="icon-button notification-button" aria-label="ดูการแจ้งเตือน" onClick={onOpenActions}>
          <Bell size={18} strokeWidth={1.8} />{activeCount > 0 && <i />}
        </button>
        <button className="profile" aria-label="เปิดโปรไฟล์">ม</button>
      </div>
    </header>
  );
}
