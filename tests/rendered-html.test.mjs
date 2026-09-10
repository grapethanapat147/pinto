import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { before } from "node:test";

import { createTestD1 } from "./support/d1.mjs";

// The page is a server component that reads D1. `resolve-hooks.mjs` (loaded via
// --import) points `cloudflare:workers` at a stub reading this global.
globalThis.__PINTO_TEST_ENV__ = { DB: createTestD1() };

async function fetchWorker(pathname, init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      method: init.method ?? "GET",
      headers: { accept: "text/html", host: "localhost", ...(init.headers ?? {}) },
      ...(init.body === undefined ? {} : { body: init.body }),
      redirect: "manual",
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

/** PIN-0011 put the dashboard behind a session, so most tests need one. */
async function signIn(as = "owner") {
  const response = await fetchWorker(`/api/auth/demo?as=${as}`, { method: "POST" });
  const token = (response.headers.get("set-cookie") ?? "").match(/pinto_session=([^;]+)/)?.[1];
  assert.ok(token, "demo sign-in should set a session cookie");
  return `pinto_session=${token}`;
}

let sessionCookie;
before(async () => {
  sessionCookie = await signIn();
});

async function render(pathname = "/", { cookie = undefined } = {}) {
  return fetchWorker(pathname, { headers: { cookie: cookie ?? sessionCookie } });
}

async function post(pathname, body) {
  return fetchWorker(pathname, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const navLabels = [
  "วันนี้",
  "สิ่งที่ต้องทำ",
  "ออเดอร์",
  "ข้อความลูกค้า",
  "สินค้าและสต๊อก",
  "ลูกค้า",
  "การเติบโต",
  "การเงิน",
];

test("server-renders the Pinto seller dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="th">/i);
  assert.match(html, /<title>Pinto — จัดการร้านออนไลน์ครบทุกช่องทาง<\/title>/i);

  assert.match(html, /class="app-shell"/);
  assert.match(html, /class="sidebar"/);
  assert.match(html, /class="topbar"/);
  assert.match(html, /aria-label="เมนูหลัก"/);
  assert.match(html, /aria-label="กลับหน้าวันนี้"/);

  for (const label of navLabels) {
    assert.match(html, new RegExp(label), `sidebar is missing nav item "${label}"`);
  }

  assert.match(html, /หน้าหลัก/);
  assert.match(html, /ภาพรวมร้าน/);
});

test("emits site-specific social metadata", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /name="description" content="ศูนย์รวมออเดอร์[^"]*"/i);
  assert.match(html, /property="og:title" content="Pinto — Seller Operations Center"/i);
  assert.match(html, /property="og:image" content="http:\/\/localhost\/pinto\/og-image\.png"/i);

  // PIN-0017: the template's blue favicon must not come back
  assert.match(html, /href="\/pinto\/favicon\.svg"/i, "Pinto's own favicon");
  assert.doesNotMatch(html, /href="\/favicon\.svg"/i, "the template icon is gone");
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.match(html, /name="twitter:image" content="http:\/\/localhost\/pinto\/og-image\.png"/i);
});

/**
 * PIN-0017 replaced the sidebar's text wordmark with SVG artwork, and both regressions this
 * guards were found by measuring the live page, not by reading the diff.
 */
test("the sidebar brand survives both CSS traps it fell into", async () => {
  const response = await render();
  const html = await response.text();
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // Both marks ship; CSS picks one, because the 82px collapsed sidebar shrinks the
  // lockup to an illegible 14px-tall smear.
  assert.match(html, /class="brand-lockup"[^>]*\/?>|logo-lockup\.svg/i);
  assert.match(html, /logo-mark\.svg/i, "the collapsed-sidebar fallback mark");
  assert.match(html, /class="brand-mark-only"|brand-mark-only/i);

  // Trap 1 — `.brand` is a flex item in the sidebar's column, and a button's automatic
  // minimum size does not hold it at content height. Without this it was squashed
  // 53px -> 36px and "Commerce Center" painted over "เมนูหลัก".
  assert.match(css, /\.brand \{[^}]*flex: 0 0 auto/, ".brand must not be allowed to shrink");

  // Trap 2 — media queries add no specificity, so the base rule that hides the fallback
  // mark has to come BEFORE the <=980px rule that reveals it. Reversed, the mark is
  // hidden at every width and the collapsed sidebar shows no brand at all.
  const hidden = css.indexOf(".brand .brand-mark-only { display: none");
  const shown = css.indexOf(".brand .brand-mark-only { display: block");
  assert.ok(hidden !== -1 && shown !== -1, "both halves of the mark toggle must exist");
  assert.ok(hidden < shown, "the base `display: none` must precede the <=980px reveal");

  // `.brand img` (0,1,1) outranks a bare `.brand-lockup` (0,1,0), so an unscoped toggle
  // loses and both marks render at once. Every occurrence must keep the `.brand ` prefix.
  assert.doesNotMatch(css, /(?<!\.brand )\.brand-lockup/, "toggle must stay scoped to .brand");
  assert.doesNotMatch(css, /(?<!\.brand )\.brand-mark-only/, "toggle must stay scoped to .brand");

  // The text lockup these replaced is gone, along with its rules.
  assert.doesNotMatch(css, /\.brand-copy/, "dead selector from the text wordmark");
  assert.doesNotMatch(css, /\.brand strong/, "dead selector from the text wordmark");
});

test("no longer serves the vinext starter skeleton", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /Your site is taking shape/i);
  assert.doesNotMatch(html, /Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
  assert.doesNotMatch(html, /codex-preview/i);
  assert.doesNotMatch(html, /sites-skeleton/i);
  assert.doesNotMatch(html, /Starter Project/i);
});

test("keeps View, navItems and viewTitles synchronized", async () => {
  const [types, navigation] = await Promise.all([
    readFile(new URL("../app/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/fixtures/navigation.ts", import.meta.url), "utf8"),
  ]);

  const viewUnion = types.match(/export type View =([^;]+);/);
  assert.ok(viewUnion, "app/types.ts should export a View union type");
  const views = [...viewUnion[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(views.length > 0, "View union should list at least one view");

  const navBlock = navigation.match(/export const navItems: NavItem\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(navBlock, "navigation.ts should export a navItems array");
  const navIds = [...navBlock[1].matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);

  const titlesBlock = navigation.match(
    /export const viewTitles: Record<View, ViewTitle> = \{([\s\S]*?)\n\};/,
  );
  assert.ok(titlesBlock, "navigation.ts should export a viewTitles record");
  const titleKeys = [...titlesBlock[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map((match) => match[1]);

  assert.deepEqual(
    navIds.slice().sort(),
    views.slice().sort(),
    "navItems ids must cover exactly the View union",
  );
  assert.deepEqual(
    titleKeys.slice().sort(),
    views.slice().sort(),
    "viewTitles keys must cover exactly the View union",
  );
  assert.deepEqual(
    navLabels.slice().sort(),
    [...navBlock[1].matchAll(/\blabel:\s*"([^"]+)"/g)].map((m) => m[1]).sort(),
    "nav labels asserted in the render test must match navigation.ts",
  );
});

test("serves orders and inventory read from D1, not fixtures", async () => {
  const response = await render();
  const html = await response.text();

  // seeded rows reach the rendered payload
  for (const externalId of ["TT-10842", "SP-48219", "LN-39204"]) {
    assert.match(html, new RegExp(externalId), `missing order ${externalId} from D1`);
  }
  for (const sku of ["ML-CV-018", "ML-CL-006"]) {
    assert.match(html, new RegExp(sku), `missing product ${sku} from D1`);
  }

  // satang integers are formatted back to the display strings the fixtures used
  assert.match(html, /฿1,890/, "189000 satang should render as ฿1,890");
  assert.match(html, /฿3,260/);

  // stock status is derived, not stored: ML-CL-006 has on_hand 0
  assert.match(html, /หมดสต๊อก/);
});

test("serves actions, conversations, campaigns and payouts from D1", async () => {
  const response = await render();
  const html = await response.text();

  // actions: impact and source strings are rebuilt from stored parts, not stored whole
  assert.match(html, /แคมเปญ TikTok ใช้งบสูงกว่าปกติ/);
  assert.match(html, /เสี่ยงเสีย ฿3,240/, "impact rebuilt from impact_kind + impact_satang");
  assert.match(html, /อัปเดต \d{2}:\d{2} น\./, "source rebuilt from detected_at");

  // the Action Center total is a live sum of open actions (spec Q3), not the old literal
  assert.match(html, /฿22,990/, "3,240 + 6,890 + 12,400 + 460 with nothing resolved");

  // conversations: preview is its own column, not the last message
  assert.match(html, /ต้องการใบกำกับภาษีค่ะ/, "editorial preview, differs from the message body");
  assert.match(html, /รบกวนออกใบกำกับภาษีในนามบริษัทได้ไหมคะ/, "the message body itself");
  assert.match(html, /เมื่อวาน/, "a previous-day message stamp stays relative");

  // campaigns: roas is derived from spend and revenue
  assert.match(html, /Home Refresh/);
  assert.match(html, /3\.14/, "20180/6420 = 3.14");
  assert.match(html, /4\.65/, "19910/4280 = 4.65");

  // payouts: order counts and amounts come back from integers
  assert.match(html, /142 ออเดอร์/);
  assert.match(html, /฿38,740/);
});

// These mutate the shared in-memory database, so they run last and in order.
test("rejects bad writes without touching the database", async () => {
  assert.equal((await post("/api/actions/9999/resolve")).status, 404, "unknown action");
  assert.equal((await post("/api/conversations/9999/messages", { body: "hi" })).status, 404, "unknown conversation");
  assert.equal((await post("/api/conversations/1/messages", { body: "   " })).status, 400, "blank message");

  // nothing above should have changed what the page serves
  const html = await (await render()).text();
  assert.match(html, /฿22,990/, "the action total must be untouched by failed writes");
});

test("resolving an action persists and reduces the live total", async () => {
  const response = await post("/api/actions/1/resolve");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { resolved: true });

  const html = await (await render()).text();
  assert.doesNotMatch(html, /แคมเปญ TikTok ใช้งบสูงกว่าปกติ/, "resolved action should be gone");
  assert.match(html, /฿19,750/, "22,990 - 3,240");
  assert.doesNotMatch(html, /฿22,990/);

  // resolving twice is not a silent success
  assert.equal((await post("/api/actions/1/resolve")).status, 404);
});

test("sending a reply persists into the thread", async () => {
  const response = await post("/api/conversations/1/messages", { body: "ยืนยันจัดส่งวันศุกร์ค่ะ" });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { sent: true });

  const html = await (await render()).text();
  assert.match(html, /ยืนยันจัดส่งวันศุกร์ค่ะ/, "the stored reply should be served back");
});

// These swap the binding, so they restore it afterwards for anything that follows.
test("shows a branded page instead of a stack trace when the database is unavailable", async () => {
  const seeded = globalThis.__PINTO_TEST_ENV__;
  globalThis.__PINTO_TEST_ENV__ = {};
  try {
    const html = await (await render()).text();

    assert.match(html, /ยังไม่สามารถโหลดข้อมูลร้านได้/, "should explain itself in Thai");
    assert.doesNotMatch(html, /__next_error__/, "should not be the framework error page");

    // must not quietly fall back to the fixtures and pass demo numbers off as live
    assert.doesNotMatch(html, /TT-10842/, "no fixture orders");
    assert.doesNotMatch(html, /฿48,720/, "no fixture money");
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

test("renders empty states rather than crashing on an empty database", async () => {
  const seeded = globalThis.__PINTO_TEST_ENV__;
  const empty = createTestD1({ seed: false });
  // an empty database has no users either, so give it just enough to have a caller —
  // the point of this test is empty *data*, not an empty user table
  await empty.prepare("INSERT INTO shops (id, name, created_at) VALUES (1, 'ทดสอบ', '2026-01-01T00:00:00.000Z')").bind().run();
  await empty
    .prepare("INSERT INTO users (id, shop_id, provider, provider_user_id, display_name, role, created_at) VALUES (1, 1, 'demo', 'demo-owner', 'ทดสอบ', 'owner', '2026-01-01T00:00:00.000Z')")
    .bind()
    .run();
  globalThis.__PINTO_TEST_ENV__ = { DB: empty };
  try {
    const response = await render("/", { cookie: await signIn() });
    assert.equal(response.status, 200, "an empty database is not an error");

    const html = await response.text();
    assert.match(html, /class="app-shell"/, "the dashboard shell should still render");
    // the default "today" view is the only one server-rendered; its Action Center panel
    // has to degrade rather than show an empty list
    assert.match(html, /จัดการครบแล้ว เก่งมาก!/, "today-view empty state");
    // and no fixture data leaks in to fill the gap
    assert.doesNotMatch(html, /TT-10842/);
    assert.doesNotMatch(html, /฿22,990/);
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

test("serves the dashboard metrics from D1 rather than JSX literals", async () => {
  const html = await (await render()).text();

  // period figures for the default "วันนี้" selector
  assert.match(html, /฿48,720/, "profit");
  assert.match(html, /฿126,840/, "sales");
  assert.match(html, /284/, "order count");

  // channel table, with margin derived from profit/sales
  assert.match(html, /฿68,420/);
  assert.match(html, /36\.4%/, "24930/68420 derived");
  assert.match(html, /43\.4%/, "7050/16240 derived");

  // quick-work notes and the pending-payout tile
  assert.match(html, /47 รายการรอแพ็ก/);
  assert.match(html, /฿73,290/);

  // the payout rail reads the payouts table rather than restating it
  assert.match(html, /142 ออเดอร์/);
  assert.match(html, /฿38,740/);
});

test("interpolates recommendation amounts from integer columns", async () => {
  const html = await (await render()).text();

  // the amount sits mid-sentence in the title; the template stores "โยกงบ {amount} ไปที่..."
  assert.match(html, /โยกงบ ฿1,200 ไปที่ Ceramic Set/, "title amount interpolated");
  assert.doesNotMatch(html, /\{amount\}/, "no placeholder should survive to the page");

  // end-of-sentence amount in a body template
  assert.match(html, /ไม่เกิน ฿24,600/, "body amount interpolated");

  // boxed figures, one with a prefix and suffix, one bare
  assert.match(html, /\+ ฿2,080 \/ วัน/, "prefix and suffix applied");
  assert.match(html, /฿46,700/);
});

test("puts the dashboard behind a session", async () => {
  const anonymous = await fetchWorker("/");
  assert.equal(anonymous.status, 307, "no session should not reach the dashboard");
  assert.equal(anonymous.headers.get("location"), "/login");

  const forged = await fetchWorker("/", { headers: { cookie: "pinto_session=totally-made-up" } });
  assert.equal(forged.status, 307, "an unknown token must not authenticate");

  const signedIn = await render();
  assert.equal(signedIn.status, 200);
  assert.match(await signedIn.text(), /class="app-shell"/);
});

test("offers a one-click demo sign-in and is honest about LINE", async () => {
  const html = await (await fetchWorker("/login")).text();

  assert.match(html, /เข้าสู่ระบบตัวอย่าง/, "the demo button");
  assert.match(html, /เข้าสู่ระบบด้วย LINE/);
  assert.match(html, /disabled/, "LINE must be disabled until a channel exists");
  assert.match(html, /ยังไม่ได้เชื่อมต่อ LINE Login/, "and say why");
});

test("stores only the token digest, and honours the row's expiry", async () => {
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const response = await fetchWorker("/api/auth/demo", { method: "POST" });
  const cookie = response.headers.get("set-cookie") ?? "";
  const token = cookie.match(/pinto_session=([^;]+)/)[1];

  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const rows = (await db.prepare("SELECT id FROM sessions").bind().all()).results;
  assert.ok(!rows.some((row) => row.id === token), "the raw token must never be stored");
  assert.ok(rows.every((row) => /^[0-9a-f]{64}$/.test(row.id)), "sessions.id should be a sha-256");

  // Expire only *this* session's row, leaving the cookie untouched: the row is the
  // authority. Scoped by id — an unscoped UPDATE expired every session including the
  // shared one, so later tests silently ran unauthenticated.
  // Derive this token's own digest. `rows.at(-1)` was wrong: SELECT has no ordering, so it
  // could pick the shared session and expire it, leaving every later render unauthenticated.
  const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const digest = [...new Uint8Array(digestBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  assert.ok(rows.some((row) => row.id === digest), "the digest should match a stored row");
  await db
    .prepare("UPDATE sessions SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?")
    .bind(digest)
    .run();
  const stale = await fetchWorker("/", { headers: { cookie: `pinto_session=${token}` } });
  assert.equal(stale.status, 307, "an expired row must reject its own live cookie");

  const others = (await db.prepare("SELECT count(*) c FROM sessions WHERE expires_at > '2026-01-01'").bind().all())
    .results[0].c;
  assert.ok(others > 0, "other sessions must be untouched");
});

test("logout revokes the session server-side", async () => {
  const cookie = await signIn();

  assert.equal((await render("/", { cookie })).status, 200);

  const out = await fetchWorker("/api/auth/logout", { method: "POST", headers: { cookie } });
  assert.equal(out.status, 303);
  assert.match(out.headers.get("set-cookie") ?? "", /pinto_session=;/, "cookie cleared");

  const after = await fetchWorker("/", { headers: { cookie } });
  assert.equal(after.status, 307, "the old cookie must be dead, not just forgotten");
});

test("rejects unauthenticated writes without touching the database", async () => {
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const before = (await db.prepare("SELECT count(*) c FROM actions WHERE resolved_at IS NOT NULL").bind().all())
    .results[0].c;

  // no cookie at all — this returned 200 and resolved a real action before PIN-0012
  const resolve = await fetchWorker("/api/actions/1/resolve", { method: "POST" });
  assert.equal(resolve.status, 401);

  const message = await fetchWorker("/api/conversations/1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "ไม่ควรถูกบันทึก" }),
  });
  assert.equal(message.status, 401);

  const after = (await db.prepare("SELECT count(*) c FROM actions WHERE resolved_at IS NOT NULL").bind().all())
    .results[0].c;
  assert.equal(after, before, "a rejected write must not change anything");
  const leaked = (await db.prepare("SELECT count(*) c FROM messages WHERE body = 'ไม่ควรถูกบันทึก'").bind().all())
    .results[0].c;
  assert.equal(leaked, 0);
});

test("scopes every read to the session's own shop", async () => {
  const seeded = globalThis.__PINTO_TEST_ENV__;
  const db = createTestD1();
  globalThis.__PINTO_TEST_ENV__ = { DB: db };
  try {
    // a genuine second shop with its own order, so isolation is demonstrated rather than assumed
    await db.prepare("INSERT INTO shops (id,name,created_at) VALUES (2,'ร้านอื่น','2026-01-01T00:00:00.000Z')").bind().run();
    await db.prepare("INSERT INTO channels (id,shop_id,code,display_name,kind) VALUES (99,2,'tiktok','TikTok Shop','marketplace')").bind().run();
    await db
      .prepare(
        "INSERT INTO orders (id,shop_id,channel_id,external_id,customer_name,total_satang,status,placed_at) " +
          "VALUES (999,2,99,'OTHER-SHOP-ORDER','ลูกค้าร้านอื่น',100000,'รอแพ็ก','2026-09-09T03:00:00.000Z')"
      )
      .bind()
      .run();

    const html = await (await render("/", { cookie: await signIn() })).text();
    assert.match(html, /TT-10842/, "its own shop's order");
    assert.doesNotMatch(html, /OTHER-SHOP-ORDER/, "another shop's order must not leak");
    assert.doesNotMatch(html, /ลูกค้าร้านอื่น/, "nor another shop's customer");
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

test("staff never receive finance data, owners do", async () => {
  const ownerHtml = await (await render("/", { cookie: await signIn("owner") })).text();
  const staffHtml = await (await render("/", { cookie: await signIn("staff") })).text();

  const navOf = (html) => [...html.matchAll(/<em>([^<]+)<\/em>/g)].map((m) => m[1]);
  assert.ok(navOf(ownerHtml).includes("การเงิน"), "owner keeps the Money nav item");
  assert.ok(!navOf(staffHtml).includes("การเงิน"), "staff must not see the Money nav item");

  // the real enforcement: the numbers are absent from the payload, not merely unrendered,
  // because AppShell is a client component and anything sent to it is readable
  for (const secret of [/฿38,740/, /฿24,680/, /฿126\.8k/]) {
    assert.match(ownerHtml, secret, "owner should see finance figures");
    assert.doesNotMatch(staffHtml, secret, "finance figures must not reach staff at all");
  }

  // performance data is deliberately kept for both — stripping it would gut the dashboard
  for (const shared of [/TT-10842/, /฿48,720/]) {
    assert.match(ownerHtml, shared);
    assert.match(staffHtml, shared);
  }

  assert.match(staffHtml, /คุณฟ้า/, "signed in as the staff demo user");
});

test("rejects an unknown demo identity", async () => {
  const response = await fetchWorker("/api/auth/demo?as=admin", { method: "POST" });
  assert.equal(response.status, 400, "only the seeded demo identities may be requested");
});

test("resolves channel identity from data, and refuses an unknown code", async () => {
  const { loadChannels, requireChannel } = await import("../db/channels.ts");
  const session = { userId: 1, shopId: 1, role: "owner", displayName: "ทดสอบ", pictureUrl: null };

  const known = await loadChannels(session);
  assert.equal(requireChannel(known, "tiktok").shortName, "TikTok");
  assert.equal(requireChannel(known, "line").shortName, "LINE");
  assert.equal(requireChannel(known, "line").accent, "line");

  // the old ternary rendered anything unrecognised as TikTok, silently
  assert.throws(
    () => requireChannel(known, "lazada"),
    /Unknown channel code/,
    "an unknown channel must fail loudly, not become TikTok"
  );
});

test("the sync grid reports real per-channel health", async () => {
  const { listChannelSync } = await import("../db/queries.ts");
  const session = { userId: 1, shopId: 1, role: "owner", displayName: "ทดสอบ", pictureUrl: null };
  const rows = await listChannelSync(session);

  assert.equal(rows.length, 3, "marketplaces and chat, not ad platforms");

  const tiktok = rows.find((r) => r.code === "tiktok");
  assert.equal(tiktok.state, "degraded", "seeded unhealthy so the grid demonstrates itself");
  assert.equal(tiktok.label, "ต้องตรวจสอบ");
  // PIN-0016 made this derived from the pending rows rather than seeded prose
  assert.match(tiktok.detail, /^สต๊อก \d+ รายการรออัปเดต$/);

  // a healthy channel with no detail must report its last sync, not "not connected" —
  // conflating "no health row" with "null detail" printed exactly that
  const shopee = rows.find((r) => r.code === "shopee");
  assert.equal(shopee.state, "healthy");
  assert.match(shopee.detail, /ซิงก์ล่าสุด/);
  assert.doesNotMatch(shopee.detail, /ยังไม่ได้เชื่อมต่อ/);

  // the accent is data, not sniffed from the display name
  assert.deepEqual(rows.map((r) => r.accent).sort(), ["line", "shopee", "tiktok"]);

  // and it reaches the page
  assert.match(await (await render()).text(), /สต๊อก \d+ รายการรออัปเดต/);
});

test("derives the stock sync label from per-channel rows", async () => {
  const { listInventory, listChannelSync } = await import("../db/queries.ts");
  const session = { userId: 1, shopId: 1, role: "owner", displayName: "ทดสอบ", pictureUrl: null };

  const inventory = await listInventory(session);
  const byKey = Object.fromEntries(inventory.map((item) => [item.sku, item.sync]));

  // both strings the deprecated prose column used to hold, now derived
  assert.equal(byKey["ML-CV-018"], "ครบ 3 ช่องทาง");
  assert.equal(byKey["ML-CL-006"], "TikTok รออัปเดต");

  // the channel's stock detail comes from the same rows, so the two cannot disagree
  const tiktok = (await listChannelSync(session)).find((row) => row.code === "tiktok");
  assert.equal(tiktok.detail, "สต๊อก 1 รายการรออัปเดต");
});

test("names every channel a product is behind on, not just the first", async () => {
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const { listInventory } = await import("../db/queries.ts");
  const session = { userId: 1, shopId: 1, role: "owner", displayName: "ทดสอบ", pictureUrl: null };

  // put ML-CV-018 behind on Shopee too — it is already synced everywhere, so this is the
  // multi-channel case the single-pending seed cannot exercise
  await db
    .prepare(
      "UPDATE inventory_channel_sync SET state = 'pending' WHERE channel_id = " +
        "(SELECT id FROM channels WHERE code = 'shopee') AND product_id = " +
        "(SELECT id FROM products WHERE sku = 'ML-CV-018')"
    )
    .bind()
    .run();

  const item = (await listInventory(session)).find((row) => row.sku === "ML-CV-018");
  assert.equal(item.sync, "Shopee รออัปเดต");

  await db
    .prepare(
      "UPDATE inventory_channel_sync SET state = 'pending' WHERE channel_id = " +
        "(SELECT id FROM channels WHERE code = 'tiktok') AND product_id = " +
        "(SELECT id FROM products WHERE sku = 'ML-CV-018')"
    )
    .bind()
    .run();

  const both = (await listInventory(session)).find((row) => row.sku === "ML-CV-018");
  assert.equal(both.sync, "TikTok, Shopee รออัปเดต", "channel order follows channel id");

  // restore: this mutates state shared with every other test in the file
  await db
    .prepare(
      "UPDATE inventory_channel_sync SET state = 'synced' WHERE product_id = " +
        "(SELECT id FROM products WHERE sku = 'ML-CV-018')"
    )
    .bind()
    .run();
  const restored = (await listInventory(session)).find((row) => row.sku === "ML-CV-018");
  assert.equal(restored.sync, "ครบ 3 ช่องทาง");
});
