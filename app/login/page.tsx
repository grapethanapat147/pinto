import { redirect } from "next/navigation";
import { MessageCircle, Sparkles, Store } from "lucide-react";

import { getSession } from "../session";

/** A database outage should still show the door, not a stack trace. */
async function currentSession() {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

/**
 * LINE Login is Pinto's destination (auth spec Q4), but no LINE channel is configured yet,
 * so that button is **disabled with a reason** rather than pretending — the PIN-0001 rule
 * applied to the front door.
 */
export default async function LoginPage() {
  if (await currentSession()) redirect("/");

  return (
    <main className="login-shell">
      <div className="panel login-card">
        <span className="brand-mark"><Store size={19} strokeWidth={2.2} /></span>
        <h1>pinto</h1>
        <p className="login-tagline">จัดการร้านออนไลน์ครบทุกช่องทางจากที่เดียว</p>

        <button className="login-line" disabled aria-disabled="true">
          <MessageCircle size={18} strokeWidth={1.9} />เข้าสู่ระบบด้วย LINE
        </button>
        <small className="login-line-note">ยังไม่ได้เชื่อมต่อ LINE Login สำหรับร้านนี้</small>

        <div className="login-divider"><span>หรือ</span></div>

        <form method="post" action="/api/auth/demo">
          <button type="submit" className="primary-button wide login-demo">
            <Sparkles size={17} strokeWidth={1.9} />เข้าสู่ระบบตัวอย่าง
          </button>
        </form>
        <small className="login-demo-note">
          เข้าดูร้านตัวอย่าง Mali Living พร้อมข้อมูลจำลอง ไม่ใช่ข้อมูลร้านจริง
        </small>
      </div>
    </main>
  );
}
