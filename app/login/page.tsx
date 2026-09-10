import { redirect } from "next/navigation";
import { MessageCircle, Sparkles, UserRound } from "lucide-react";

import { PintoLogo, PintoMascot } from "../components/PintoBrand";
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
        {/* `full` at the handoff's 300px floor, which is exactly what the card's 304px of
            content allows. The first delivery could not carry it — its chip sat too close to
            the figure to survive the crop — so this page ran `bust` at 168px. The redrawn
            artwork moves the chip clear of the face, and at 300px it reads. Below 400px the
            card narrows to 286px and `.login-mascot`'s max-width scales it down from there.
            Only the width is given: `fit()` derives the height, so the ratio has one source. */}
        <PintoMascot variant="full" width={300} className="login-mascot" />
        <h1><PintoLogo height={30} /></h1>
        <p className="login-tagline">จัดการร้านออนไลน์ครบทุกช่องทางจากที่เดียว</p>

        <button className="login-line" disabled aria-disabled="true">
          <MessageCircle size={18} strokeWidth={1.9} />เข้าสู่ระบบด้วย LINE
        </button>
        <small className="login-line-note">ยังไม่ได้เชื่อมต่อ LINE Login สำหรับร้านนี้</small>

        <div className="login-divider"><span>หรือ</span></div>

        <form method="post" action="/api/auth/demo?as=owner">
          <button type="submit" className="primary-button wide login-demo">
            <Sparkles size={17} strokeWidth={1.9} />เข้าสู่ระบบตัวอย่าง — เจ้าของร้าน
          </button>
        </form>
        <form method="post" action="/api/auth/demo?as=staff">
          <button type="submit" className="secondary-button wide login-demo login-demo-staff">
            <UserRound size={17} strokeWidth={1.9} />เข้าสู่ระบบตัวอย่าง — พนักงาน
          </button>
        </form>
        <small className="login-demo-note">
          ร้านตัวอย่าง Mali Living พร้อมข้อมูลจำลอง ไม่ใช่ข้อมูลร้านจริง
          <br />พนักงานจะไม่เห็นเมนูการเงินและกำหนดการรับเงิน
        </small>
      </div>
    </main>
  );
}
