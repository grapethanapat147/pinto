import { TriangleAlert } from "lucide-react";

import { PintoLogo } from "./PintoBrand";

/**
 * Shown when the dashboard cannot read its data.
 *
 * It deliberately does NOT fall back to the fixtures. Presenting last-known demo numbers
 * as though they were live is exactly the failure PIN-0001 removed from the buttons, and
 * it would be worse here: a shop owner could act on figures that are not real.
 */
export function DataUnavailable({ detail }: { detail?: string }) {
  return (
    <main className="data-unavailable">
      <div className="panel">
        <PintoLogo markOnly width={38} className="brand-mark" />
        <span className="unavailable-icon"><TriangleAlert size={22} strokeWidth={1.9} /></span>
        <h1>ยังไม่สามารถโหลดข้อมูลร้านได้</h1>
        <p>
          ระบบเชื่อมต่อฐานข้อมูลไม่สำเร็จ จึงยังไม่แสดงตัวเลขใด ๆ
          เพื่อไม่ให้เห็นข้อมูลเก่าที่อาจไม่ตรงกับความจริง
        </p>
        <p className="unavailable-hint">
          ลองโหลดหน้านี้ใหม่อีกครั้ง หากยังไม่ได้ กรุณาแจ้งทีมงาน
        </p>
        {/* The raw message names internal config paths — useful locally, noise and a
            small information leak for a shop owner, so it stays out of production. */}
        {detail && import.meta.env.DEV ? <code>{detail}</code> : null}
      </div>
    </main>
  );
}
