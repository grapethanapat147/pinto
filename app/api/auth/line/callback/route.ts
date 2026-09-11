import { createSession, findUserByProvider, refreshProfile } from "../../../../../db/auth";
import { sessionCookie } from "../../cookie";
import { exchangeCode, lineConfig } from "../provider";
import { NONCE_COOKIE, STATE_COOKIE, clearedCookies, readCookie, timingSafeEqual } from "../state";

/** Every exit clears the one-shot state cookies, so an attempt cannot be replayed. */
function respond(status: number, headers: Record<string, string>, body: BodyInit | null = null) {
  const out = new Headers(headers);
  for (const value of clearedCookies()) out.append("set-cookie", value);
  return new Response(body, { status, headers: out });
}

/**
 * An honest dead end rather than a stack trace, in Thai, matching the login page's voice.
 * `detail` is always text this caller is entitled to see — never the channel secret, the
 * authorization code, or another user's data.
 */
function problemPage(title: string, detail: string, status: number, extra = "") {
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return respond(
    status,
    { "content-type": "text/html; charset=utf-8" },
    `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>
 body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
        background:#f5f0ec; color:#211d1b; font-family:"Noto Sans Thai",Tahoma,sans-serif; }
 main { width:100%; max-width:420px; padding:32px 28px; background:#fff;
        border:1px solid #ebe4df; border-radius:8px; text-align:center; }
 h1 { margin:0 0 10px; font-size:19px; font-weight:600; }
 p { margin:0 0 18px; color:#766f6b; font-size:13px; line-height:1.55; }
 code { display:block; margin:0 0 18px; padding:11px 13px; background:#f5f0ec;
        border-radius:7px; font-size:12px; text-align:left; word-break:break-all; }
 a { display:inline-block; min-height:44px; padding:12px 18px; border-radius:7px;
     background:#c85410; color:#fff; font-size:13px; font-weight:500; text-decoration:none; }
</style></head><body><main>
<h1>${escape(title)}</h1><p>${escape(detail)}</p>${extra}
<a href="/login">กลับไปหน้าเข้าสู่ระบบ</a></main></body></html>`,
  );
}

/**
 * The LINE Login callback (PIN-0014).
 *
 * Order matters: `state` is checked before anything touches the database, so a forged
 * callback costs nothing. The identity is only trusted after LINE has verified the ID token
 * against the channel and echoed the nonce this browser was issued.
 */
export async function GET(request: Request) {
  const config = lineConfig();
  if (!config) {
    return problemPage(
      "ยังไม่ได้ตั้งค่า LINE Login",
      "ร้านนี้ยังไม่ได้เชื่อมต่อ LINE Login สำหรับการติดตั้งนี้",
      503,
    );
  }

  const url = new URL(request.url);

  // LINE reports a refusal by redirecting back with `error`, not by failing the request.
  const refusal = url.searchParams.get("error");
  if (refusal) {
    return problemPage(
      "ยังไม่ได้เข้าสู่ระบบ",
      refusal === "access_denied"
        ? "คุณยกเลิกการอนุญาตที่หน้า LINE"
        : `LINE ตอบกลับว่า: ${url.searchParams.get("error_description") ?? refusal}`,
      400,
    );
  }

  const issuedState = readCookie(request, STATE_COOKIE);
  const returnedState = url.searchParams.get("state");
  if (!issuedState || !returnedState || !timingSafeEqual(issuedState, returnedState)) {
    return problemPage(
      "ลิงก์เข้าสู่ระบบไม่ถูกต้อง",
      "คำขอนี้ไม่ตรงกับที่เริ่มไว้จากเบราว์เซอร์นี้ หรือหมดอายุแล้ว กรุณาเริ่มใหม่",
      400,
    );
  }

  const nonce = readCookie(request, NONCE_COOKIE);
  const code = url.searchParams.get("code");
  if (!nonce || !code) {
    return problemPage("ลิงก์เข้าสู่ระบบไม่ครบ", "คำขอนี้ขาดข้อมูลที่จำเป็น กรุณาเริ่มใหม่", 400);
  }

  let identity;
  try {
    identity = await exchangeCode(config, code, nonce);
  } catch (error) {
    return problemPage(
      "ยืนยันตัวตนกับ LINE ไม่สำเร็จ",
      error instanceof Error ? error.message : "ไม่ทราบสาเหตุ",
      502,
    );
  }

  const user = await findUserByProvider("line", identity.providerUserId);

  // No row means no shop and no role. Creating one here would attach a stranger's LINE
  // account to an existing shop's orders, customers and payouts, so this refuses instead
  // and shows the caller their own id — the only way to be granted access is at the server.
  if (!user) {
    return problemPage(
      "บัญชี LINE นี้ยังไม่มีสิทธิ์เข้าร้าน",
      "เข้าสู่ระบบกับ LINE สำเร็จแล้ว แต่บัญชีนี้ยังไม่ได้ผูกกับร้านใดใน Pinto ส่งรหัสด้านล่างให้เจ้าของร้านเพื่อเปิดสิทธิ์",
      403,
      `<code>${identity.providerUserId.replace(/[<&>]/g, "")}</code>`,
    );
  }

  // LINE has just vouched for this name and picture, so they are the truth. The row may
  // still be carrying the placeholder `grant-line-access.mjs` wrote before this person had
  // ever signed in.
  const signedIn = await refreshProfile(user, identity);

  const { token, expiresAt } = await createSession(signedIn);
  return respond(303, { location: "/", "set-cookie": sessionCookie(token, expiresAt) });
}
