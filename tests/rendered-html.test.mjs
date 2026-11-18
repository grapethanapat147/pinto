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
  "การเชื่อมต่อ",
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

/**
 * The brand artwork has now been replaced once (a second delivery redrew every mark and
 * changed the lockup from 199x68 to 270x78). Both times the risk was the same: `PintoBrand`
 * carries the proportions in TypeScript, and nothing tied them to the files on disk. When
 * they drifted, `height={30}` emitted the stale `width="199"` and rendered the lockup
 * stretched. This checks the app's own output against each artwork's `viewBox`.
 */
test("every brand image is emitted at the artwork's own aspect ratio", async () => {
  const pages = [
    ["/", sessionCookie],
    ["/login", "pinto_session=none"],
  ];

  const seen = new Set();
  for (const [pathname, cookie] of pages) {
    const html = await (await render(pathname, { cookie })).text();

    for (const tag of html.match(/<img[^>]+src="\/pinto\/[^"]+"[^>]*>/g) ?? []) {
      const file = tag.match(/src="\/pinto\/([^"]+)"/)[1];
      if (!file.endsWith(".svg")) continue;

      const width = Number(tag.match(/width="(\d+)"/)?.[1]);
      const height = Number(tag.match(/height="(\d+)"/)?.[1]);
      assert.ok(
        Number.isFinite(width) && Number.isFinite(height),
        `${file} must carry both width and height so the browser reserves the right box`,
      );

      const svg = await readFile(new URL(`../public/pinto/${file}`, import.meta.url), "utf8");
      const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      assert.ok(viewBox, `${file} must declare a viewBox`);

      const artwork = Number(viewBox[1]) / Number(viewBox[2]);
      const emitted = width / height;
      assert.ok(
        Math.abs(emitted - artwork) / artwork < 0.01,
        `${file} is emitted ${width}x${height} (${emitted.toFixed(3)}) but the artwork is ` +
          `${viewBox[1]}x${viewBox[2]} (${artwork.toFixed(3)}) — it would render distorted`,
      );
      seen.add(file);
    }
  }

  // Guards the loop itself: if the markup stops matching, the assertions above never run.
  assert.ok(seen.has("logo-lockup.svg"), "the sidebar and login lockup");
  assert.ok(seen.has("logo-mark.svg"), "the collapsed-sidebar mark");
  assert.ok([...seen].some((f) => f.startsWith("mascot-")), "the login mascot");
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

/**
 * The welcome headline, the shop name and the avatar were all literals: "ยินดีต้อนรับกลับ
 * คุณมะลิ!", "ร้าน Mali Living", "ML". Every visitor was greeted as the demo owner. It only
 * became visible once เกรพ signed in with LINE and the page still called him คุณมะลิ.
 */
test("greets whoever is signed in, and names their own shop", async () => {
  // React marks the boundary between literal text and an interpolated value with an empty
  // HTML comment, so `ยินดีต้อนรับกลับ {name}!` serialises with `<!-- -->` either side of the
  // name. Strip them before matching, or the assertion tests React's serialiser rather than
  // the page.
  const text = (html) => html.replace(/<!--.*?-->/g, "");

  const ownerHtml = text(await (await render()).text());

  // The seeded demo owner is คุณมะลิ of Mali Living, so the strings are right for *this*
  // session — what matters is where they come from.
  assert.match(ownerHtml, /ยินดีต้อนรับกลับ คุณมะลิ!/);

  const staffCookie = await signIn("staff");
  const staffHtml = text(await (await render("/", { cookie: staffCookie })).text());

  assert.match(staffHtml, /ยินดีต้อนรับกลับ คุณฟ้า/, "a different user must get their own name");
  assert.doesNotMatch(staffHtml, /ยินดีต้อนรับกลับ คุณมะลิ/, "the demo owner's name must not be baked in");

  // The shop's own name, asserted against the rendered store card rather than anywhere in
  // the document — the serialised RSC props carry the name too, so a document-wide match
  // passes even when the visible markup is a literal.
  const shop = await globalThis.__PINTO_TEST_ENV__.DB.prepare("SELECT name FROM shops WHERE id = 1").bind().first();
  const storeCard = ownerHtml.match(/<div class="store-card">[\s\S]{0,400}?<\/div>\s*<form/);
  assert.ok(storeCard, "the sidebar store card should be rendered");
  assert.ok(
    storeCard[0].includes(`<strong>${shop.name}</strong>`),
    `the store card must print the shop row's name, got: ${storeCard[0].slice(0, 200)}`,
  );
  assert.ok(storeCard[0].includes(">ML<"), "the avatar drops the ร้าน prefix before taking initials");

  // Matching the seeded name proves nothing on its own — a literal "ร้าน Mali Living" / "ML"
  // in the markup would satisfy it. Rename the shop and the card has to follow.
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  await db.prepare("UPDATE shops SET name = 'ร้าน Pinto Test' WHERE id = 1").bind().run();
  try {
    const renamed = text(await (await render()).text());
    const card = renamed.match(/<div class="store-card">[\s\S]{0,400}?<\/div>\s*<form/);
    assert.ok(card[0].includes("<strong>ร้าน Pinto Test</strong>"), "the name must follow the row");
    assert.ok(card[0].includes(">PT<"), "the initials must be derived, not written into the markup");
  } finally {
    await db.prepare("UPDATE shops SET name = ? WHERE id = 1").bind(shop.name).run();
  }
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
  assert.equal((await post("/api/actions/snooze", { key: "fraud:orders" })).status, 400, "unknown rule");
  assert.equal((await post("/api/actions/snooze", { key: "stock:x; DROP TABLE orders" })).status, 400, "malformed key");
  assert.equal((await post("/api/actions/snooze", {})).status, 400, "no key");
  assert.equal((await post("/api/conversations/9999/messages", { body: "hi" })).status, 404, "unknown conversation");
  assert.equal((await post("/api/conversations/1/messages", { body: "   " })).status, 400, "blank message");

  // nothing above should have changed anything
  const { n } = await globalThis.__PINTO_TEST_ENV__.DB.prepare("SELECT COUNT(*) AS n FROM action_snoozes").bind().first();
  assert.equal(n, 0, "a rejected snooze must not be stored");
});

test("snoozing a card hides it until the next Bangkok day, for this shop only", async () => {
  assert.match(await (await render()).text(), /chat:unread/, "the unread-chat card is there to begin with");

  const response = await post("/api/actions/snooze", { key: "chat:unread" });
  assert.equal(response.status, 200);
  const { until } = await response.json();
  // next midnight in Bangkok, which is 17:00 UTC
  assert.match(until, /T17:00:00\.000Z$/);
  assert.ok(Date.parse(until) > Date.now() && Date.parse(until) - Date.now() <= 86_400_000);

  assert.doesNotMatch(await (await render()).text(), /chat:unread/, "hidden after snoozing");

  // an expired snooze no longer hides it
  await globalThis.__PINTO_TEST_ENV__.DB.prepare("UPDATE action_snoozes SET until = '2000-01-01T00:00:00.000Z'").bind().run();
  assert.match(await (await render()).text(), /chat:unread/, "back once the snooze has passed");
  await globalThis.__PINTO_TEST_ENV__.DB.prepare("DELETE FROM action_snoozes").bind().run();
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
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

test("serves the dashboard metrics from D1 rather than JSX literals", async () => {
  const html = await (await render()).text();

  // The period figures and channel table are computed from orders since PIN-0027 — see
  // "today's figures are computed from orders" below. What is still a seeded row:

  // the pending-payout tile
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
  const before = (await db.prepare("SELECT count(*) c FROM action_snoozes").bind().all()).results[0].c;

  // no cookie at all — the resolve route this replaced returned 200 before PIN-0012
  const snooze = await fetchWorker("/api/actions/snooze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "chat:unread" }),
  });
  assert.equal(snooze.status, 401);

  const message = await fetchWorker("/api/conversations/1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "ไม่ควรถูกบันทึก" }),
  });
  assert.equal(message.status, 401);

  const after = (await db.prepare("SELECT count(*) c FROM action_snoozes").bind().all()).results[0].c;
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
        // no explicit id: the seed's generated history owns a large id range
        "INSERT INTO orders (shop_id,channel_id,external_id,customer_name,total_satang,status,placed_at) " +
          "VALUES (2,99,'OTHER-SHOP-ORDER','ลูกค้าร้านอื่น',100000,'รอแพ็ก','2026-09-09T03:00:00.000Z')"
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

/**
 * The connections screen (PIN-0025). It exists before the marketplace APIs do, so the thing
 * worth guarding is that it never claims otherwise — a button that looks live and does
 * nothing is what PIN-0001 exists to prevent.
 */
test("the connections screen never offers a connection it cannot make", async () => {
  const html = await (await render()).text();

  // The screen is a client view, so its markup is not in the first response — the data it
  // renders from is. Asserting on that is stronger anyway: it is the source the buttons
  // derive from, so it cannot be right here and wrong on screen.
  assert.match(html, /<em>การเชื่อมต่อ<\/em>/, "an owner gets the nav item");
  assert.match(html, /ยังไม่ได้ตั้งค่า Shopee Open Platform/, "Shopee is blocked, with its reason");
  assert.match(html, /ยังไม่ได้ตั้งค่า TikTok Shop Partner/, "TikTok is blocked, with its reason");

  // **No channel may be connectable while no provider has credentials.** Counted rather than
  // sampled, so adding a channel cannot quietly ship a live button.
  const connectable = html.match(/\\"connectable\\":true/g) ?? [];
  assert.equal(connectable.length, 0, `${connectable.length} channel(s) claim to be connectable`);
  const blocked = html.match(/\\"connectable\\":false/g) ?? [];
  assert.ok(blocked.length >= 5, `expected every channel to report blocked, found ${blocked.length}`);

  // A raw ISO stamp in the payload means the query layer stopped formatting it (spec D3).
  const stamps = html.match(/\\"lastSyncedAt\\":\\"[^"\\\\]*/g) ?? [];
  for (const stamp of stamps) {
    assert.doesNotMatch(stamp, /\d{4}-\d{2}-\d{2}T\d{2}:/, `an unformatted stamp reached the view: ${stamp}`);
  }
});

test("staff cannot reach the connections screen or its data", async () => {
  const staffCookie = await signIn("staff");
  const staffHtml = await (await render("/", { cookie: staffCookie })).text();

  assert.doesNotMatch(staffHtml, /<em>การเชื่อมต่อ<\/em>/, "the nav item must be filtered out");
  assert.doesNotMatch(staffHtml, /ยังไม่ได้ตั้งค่า Shopee Open Platform/, "no provider detail");
  assert.doesNotMatch(staffHtml, /"connections":\[\{/, "and no connection data in the payload");

  // The sidebar's upgrade card carries a "จัดการการเชื่อมต่อ" button that now navigates to
  // this owner-only view. Left visible it is a door that leads nowhere, which is the same
  // class of lie as a button that does nothing.
  assert.doesNotMatch(staffHtml, /จัดการการเชื่อมต่อ/, "no door to a view they cannot open");

  const ownerHtml = await (await render()).text();
  assert.match(ownerHtml, /<em>การเชื่อมต่อ<\/em>/, "an owner still gets it");
});

/**
 * Order lines and unit cost (PIN-0026). The foundation for computing profit, so the
 * invariants are checked against the seeded database itself rather than the fixture — the
 * seed is what the app reads.
 */
test("every order's lines sum exactly to its total", async () => {
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const { results } = await db
    .prepare(
      `SELECT o.external_id AS id, o.total_satang AS total,
              COALESCE(SUM(l.quantity * l.unit_price_satang), 0) AS lines
       FROM orders o LEFT JOIN order_lines l ON l.order_id = o.id
       GROUP BY o.id`,
    )
    .bind()
    .all();

  assert.ok(results.length > 0, "there should be seeded orders to check");
  for (const row of results) {
    assert.equal(
      row.lines,
      row.total,
      `order ${row.id}: lines sum to ${row.lines} satang but the order says ${row.total}`,
    );
  }
});

test("each line snapshots its product's cost, and uncosted stays null rather than zero", async () => {
  const db = globalThis.__PINTO_TEST_ENV__.DB;

  // The snapshot is what keeps a later price change from rewriting history.
  const mismatched = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM order_lines l JOIN products p ON p.id = l.product_id
       WHERE l.unit_cost_satang IS NOT p.unit_cost_satang`,
    )
    .bind()
    .first();
  assert.equal(mismatched.n, 0, "a line's cost snapshot disagrees with its product at seed time");

  // Partial coverage has to be real data, or PIN-0027's coverage display is untested.
  const uncosted = await db
    .prepare("SELECT COUNT(*) AS n FROM products WHERE unit_cost_satang IS NULL")
    .bind()
    .first();
  assert.ok(uncosted.n >= 1, "at least one product must be uncosted so partial coverage exists");

  // Null means "not costed yet". Zero would mean "free", and would silently inflate profit.
  const zero = await db
    .prepare("SELECT COUNT(*) AS n FROM products WHERE unit_cost_satang = 0")
    .bind()
    .first();
  assert.equal(zero.n, 0, "an uncosted product must be null, never 0");
});

/**
 * PIN-0027: sales, ads and profit are computed from orders, up to the last sync.
 *
 * The expected figures are worked out here in plain SQL, independently of `db/performance.ts`,
 * so a mistake in the app's window arithmetic cannot also be in the expectation.
 */
const ownerSession = { userId: 1, shopId: 1, role: "owner", displayName: "ทดสอบ", pictureUrl: null };
/** React puts `<!-- -->` between literal text and an interpolation. */
const stripComments = (html) => html.replace(/<!--.*?-->/g, "");
const baht = (satang) => `฿${Math.round(satang / 100).toLocaleString("en-US")}`;

/** Bangkok midnight of an instant, computed differently from the app: via the +07:00 date string. */
function bangkokMidnight(instant) {
  const day = new Date(instant + 7 * 3600_000).toISOString().slice(0, 10);
  return Date.parse(`${day}T00:00:00+07:00`);
}

async function independentDay(db, from, to) {
  const window = [new Date(from).toISOString(), new Date(to).toISOString()];
  const orders = await db
    .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total_satang), 0) AS sales FROM orders WHERE shop_id = 1 AND placed_at >= ? AND placed_at <= ?")
    .bind(...window)
    .first();
  const lines = await db
    .prepare(
      "SELECT COALESCE(SUM(l.quantity * l.unit_cost_satang), 0) AS cogs, " +
        "COALESCE(SUM(CASE WHEN l.unit_cost_satang IS NOT NULL THEN l.quantity * l.unit_price_satang END), 0) AS costed " +
        "FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE o.shop_id = 1 AND o.placed_at >= ? AND o.placed_at <= ?"
    )
    .bind(...window)
    .first();
  return { orders: orders.n, sales: orders.sales, cogs: lines.cogs, costed: lines.costed };
}

test("today's figures are computed from orders, up to the last sync", async () => {
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const { at } = await db.prepare("SELECT MAX(last_synced_at) AS at FROM channel_health WHERE shop_id = 1").bind().first();
  const anchor = Date.parse(at);
  const today = await independentDay(db, bangkokMidnight(anchor), anchor);
  const bangkokToday = new Date(anchor + 7 * 3600_000).toISOString().slice(0, 10);
  const { ads } = await db
    .prepare("SELECT COALESCE(SUM(spend_satang), 0) AS ads FROM ad_spend_daily WHERE shop_id = 1 AND day = ?")
    .bind(bangkokToday)
    .first();
  assert.ok(today.orders > 50, `the seed should make a busy day, got ${today.orders} orders`);
  assert.ok(ads > 0, "and spend on ads for it");

  const { listDashboardMetrics } = await import("../db/queries.ts");
  const metrics = await listDashboardMetrics(ownerSession);
  const figures = metrics.periods["วันนี้"];

  assert.equal(figures.orders, today.orders.toLocaleString("en-US"));
  assert.equal(figures.sales, baht(today.sales));
  assert.equal(figures.ads, baht(ads));
  assert.equal(figures.profit, baht(today.sales - today.cogs - ads), "profit = sales − known cost of goods − ads");

  // the anchor is shown, not a literal 10:42
  const expectedTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(anchor));
  assert.equal(metrics.asOf.time, expectedTime);

  // and it reaches the page
  const html = stripComments(await (await render()).text());
  assert.match(html, new RegExp(figures.profit.replace("$", "\\$")), "today's profit on the card");
  assert.match(html, new RegExp(`อัปเดตล่าสุด ${expectedTime} น\\.`), "the sync time on the card");
  assert.doesNotMatch(html, /10:42 น\./, "the old literal update time must be gone");
});

test("the channel table and the waterfall add up to the Today card", async () => {
  const { loadPerformance, profitOf } = await import("../db/performance.ts");
  const performance = await loadPerformance(ownerSession);
  const today = performance.periods["วันนี้"].current;

  // In satang, before any rounding for display. Compared with the independent SQL, not with
  // the app's own day total — that total is itself the sum of the channels, so checking one
  // against the other could never fail.
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const day = await independentDay(db, bangkokMidnight(performance.anchor.getTime()), performance.anchor.getTime());
  const channels = [...performance.channels.values()];
  const sumOf = (field) => channels.reduce((total, row) => total + row[field], 0);
  assert.equal(sumOf("orders"), day.orders, "channels' orders must sum to the day's");
  assert.equal(sumOf("salesSatang"), day.sales, "channels' sales must sum to the day's");
  assert.equal(sumOf("cogsSatang"), day.cogs, "channels' cost of goods must sum to the day's");
  assert.equal(sumOf("costedSalesSatang"), day.costed, "channels' costed sales must sum to the day's");
  assert.equal(sumOf("adsSatang"), today.adsSatang);
  assert.ok(channels.length >= 3, "every selling channel has orders today");

  const { listDashboardMetrics } = await import("../db/queries.ts");
  const metrics = await listDashboardMetrics(ownerSession);
  assert.deepEqual(
    metrics.waterfall.map((step) => step.kind),
    ["sales", "cost", "ads", "profit"],
    "fees are not shown as a figure while nothing supplies them"
  );
  // sales − cost − ads lands exactly on profit
  assert.equal(today.salesSatang - today.cogsSatang - today.adsSatang, profitOf(today));
  // bars are to scale: cost's bar against sales' bar is cost against sales
  const [sales, cost] = metrics.waterfall;
  assert.ok(
    Math.abs(cost.height / sales.height - today.cogsSatang / today.salesSatang) < 0.02,
    `cost bar ${cost.height}% vs sales bar ${sales.height}% should match ${today.cogsSatang}/${today.salesSatang}`
  );
});

test("today is compared with yesterday up to the same minute, not with all of yesterday", async () => {
  const { windowsFor, adShare, bangkokDayStart } = await import("../db/performance.ts");

  // 12:10 in Bangkok on 6 Oct
  const anchor = Date.parse("2026-10-06T12:10:00+07:00");
  const { current, previous } = windowsFor(anchor, 1);
  assert.equal(new Date(current.from).toISOString(), "2026-10-05T17:00:00.000Z", "today starts at Bangkok midnight");
  assert.equal(new Date(previous.from).toISOString(), "2026-10-04T17:00:00.000Z");
  assert.equal(new Date(previous.to).toISOString(), "2026-10-05T05:10:00.000Z", "yesterday ends at 12:10 too");

  // 00:30 in Bangkok is still the previous day in UTC — the day must be Bangkok's
  assert.equal(new Date(bangkokDayStart(Date.parse("2026-10-06T00:30:00+07:00"))).toISOString(), "2026-10-05T17:00:00.000Z");

  // 30 days back to back, and seven
  const month = windowsFor(anchor, 30);
  assert.equal(month.previous.to, anchor - 30 * 86_400_000, "same time of day, one period earlier");
  assert.equal(month.current.from - month.previous.from, 30 * 86_400_000);

  // today's ad row is spend-to-date, so all of it is in today; yesterday's row is a whole day
  // and only the hours up to 12:10 belong in the comparison
  assert.equal(adShare("2026-10-06", anchor, current), 1);
  assert.equal(adShare("2026-10-05", anchor, current), 0);
  assert.ok(Math.abs(adShare("2026-10-05", anchor, previous) - (12 * 60 + 10) / 1440) < 1e-9);
});

test("windows end at the last sync, and say so when that was not today", async () => {
  const seeded = globalThis.__PINTO_TEST_ENV__;
  const db = createTestD1();
  globalThis.__PINTO_TEST_ENV__ = { DB: db };
  try {
    const { listDashboardMetrics } = await import("../db/queries.ts");
    const before = await listDashboardMetrics(ownerSession);

    // an order placed after the last sync has not been fetched, so it must not count
    const { at } = await db.prepare("SELECT MAX(last_synced_at) AS at FROM channel_health").bind().first();
    const later = new Date(Date.parse(at) + 60_000).toISOString();
    await db
      .prepare("INSERT INTO orders (shop_id,channel_id,external_id,customer_name,total_satang,status,placed_at) VALUES (1,1,'AFTER-SYNC','ทดสอบ',5000000,'รอแพ็ก',?)")
      .bind(later)
      .run();
    const after = await listDashboardMetrics(ownerSession);
    assert.equal(after.periods["วันนี้"].sales, before.periods["วันนี้"].sales, "an order after the anchor is outside the window");

    // a demo seeded days ago keeps its figures, and stops calling them today's
    await db.prepare("UPDATE channel_health SET last_synced_at = datetime(last_synced_at, '-3 days')").bind().run();
    await db.prepare("UPDATE channel_health SET last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', last_synced_at)").bind().run();
    const stale = await listDashboardMetrics(ownerSession);
    assert.equal(stale.asOf.isToday, false);
    assert.ok(Number(stale.periods["วันนี้"].orders.replace(/,/g, "")) > 50, "the anchor day still has its orders");
    const html = stripComments(await (await render("/", { cookie: await signIn() })).text());
    assert.match(html, new RegExp(`ข้อมูลถึง ${stale.asOf.day} ${stale.asOf.time} น\\.`), "the card names the day");
    assert.match(html, new RegExp(`กำไร ${stale.asOf.day}`), "and the heading names the day, spaced like กำไร 7 วัน");
    assert.doesNotMatch(html, /กำไรวันนี้/);
    // the Money hero's label is a stored row that said วันนี้ — found live on the deployed demo
    const moneyProfit = stale.tiles.money.find((tile) => tile.key === "profit");
    assert.equal(moneyProfit.label, `กำไรโดยประมาณ ${stale.asOf.day}`);
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

test("partial cost coverage is always labelled, and full coverage never is", async () => {
  const { listDashboardMetrics } = await import("../db/queries.ts");
  const partial = (await listDashboardMetrics(ownerSession)).periods["วันนี้"];
  assert.equal(partial.partial, true, "one product is uncosted in the seed");
  const db = globalThis.__PINTO_TEST_ENV__.DB;
  const anchor = Date.parse((await db.prepare("SELECT MAX(last_synced_at) AS at FROM channel_health").bind().first()).at);
  const today = await independentDay(db, bangkokMidnight(anchor), anchor);
  assert.equal(partial.coverage, `${Math.floor((today.costed / today.sales) * 1000) / 10}%`);
  assert.match(stripComments(await (await render()).text()), new RegExp(`ต้นทุนครบ ${partial.coverage.replace(".", "\\.")} ของยอดขาย`));

  const seeded = globalThis.__PINTO_TEST_ENV__;
  const fresh = createTestD1();
  globalThis.__PINTO_TEST_ENV__ = { DB: fresh };
  try {
    // cost the last product, and backfill its lines' snapshots the way a correction would
    await fresh.prepare("UPDATE products SET unit_cost_satang = 24000 WHERE unit_cost_satang IS NULL").bind().run();
    await fresh.prepare("UPDATE order_lines SET unit_cost_satang = 24000 WHERE unit_cost_satang IS NULL").bind().run();
    const full = await listDashboardMetrics(ownerSession);
    assert.equal(full.periods["วันนี้"].partial, false);
    assert.equal(full.periods["วันนี้"].coverage, "100%");
    assert.deepEqual(full.uncosted, []);
    const html = stripComments(await (await render("/", { cookie: await signIn() })).text());
    assert.doesNotMatch(html, /ต้นทุนครบ [\d.]+% ของยอดขาย/, "no partial warning on a fully costed catalogue");
    assert.match(html, /ยังไม่รวมค่าธรรมเนียมและค่าส่ง/, "fees are still named as missing");
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

test("the order list is bounded, and says how many it is not showing", async () => {
  const { listOrders, countOrders, ORDER_LIST_LIMIT } = await import("../db/queries.ts");
  const shown = await listOrders(ownerSession);
  const total = await countOrders(ownerSession);
  assert.equal(shown.length, ORDER_LIST_LIMIT);
  assert.ok(total > 10 * ORDER_LIST_LIMIT, `sixty days of history, got ${total}`);
  assert.equal(shown[0].id, "TT-10842", "newest first, and the hand-made orders are the newest");

  // the payload carries the page, not the history
  const html = await (await render()).text();
  const ids = new Set(html.match(/(?:TT|SP|LN)-\d{5}/g));
  assert.ok(ids.size <= ORDER_LIST_LIMIT + 10, `${ids.size} order ids reached the client`);
});

/**
 * PIN-0029: the production backfill. The deployed database was seeded before PIN-0026 — six
 * hand-made orders, no lines, no ad spend, no costs — and holds a granted LINE account, so it
 * is brought forward additively instead of reseeded. This rebuilds that state and runs the
 * same SQL the remote script runs.
 */
test("the backfill brings a pre-PIN-0026 database forward without touching a row it had", async () => {
  const seeded = globalThis.__PINTO_TEST_ENV__;
  const db = createTestD1();
  globalThis.__PINTO_TEST_ENV__ = { DB: db };
  try {
    // the deployed database as it was: hand-made orders only, nothing PIN-0026/27 added,
    // and its data from weeks ago, the way production's 12 Sep seed is
    await db.exec(`
      DELETE FROM order_lines; DELETE FROM ad_spend_daily;
      DELETE FROM orders WHERE external_id NOT IN ('TT-10842','SP-48219','TT-10841','LN-39204','SP-48218','TT-10840');
      UPDATE products SET unit_cost_satang = NULL;
      UPDATE products SET unit_cost_satang = 99900 WHERE sku = 'ML-TR-031';
      UPDATE orders SET placed_at = strftime('%Y-%m-%dT%H:%M:%fZ', placed_at, '-24 days');
      UPDATE channel_health SET last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', last_synced_at, '-24 days');
      INSERT INTO users (shop_id, provider, provider_user_id, display_name, role) VALUES (1, 'line', 'U-granted', 'Grape', 'owner');
    `);
    const snapshot = async () =>
      JSON.stringify([
        await db.prepare("SELECT * FROM users ORDER BY id").bind().all(),
        await db.prepare("SELECT * FROM orders ORDER BY id").bind().all(),
        await db.prepare("SELECT id, sku, name FROM products ORDER BY id").bind().all(),
        await db.prepare("SELECT * FROM channel_health ORDER BY id").bind().all(),
      ]);
    const before = await snapshot();

    const { at } = await db.prepare("SELECT MAX(last_synced_at) AS at FROM channel_health").bind().first();
    const anchor = new Date(at);
    const { backfillSql } = await import("../scripts/backfill-history.ts");
    const { sql, summary } = backfillSql({ shopId: 1, anchor, reservedToday: 6 });
    await db.exec(`PRAGMA foreign_keys = ON;\n${sql}`);

    // nothing it had was changed — the new orders are appended, so the first six still match
    const after = JSON.parse(await snapshot());
    const was = JSON.parse(before);
    assert.deepEqual(after[0], was[0], "users, including the granted LINE account, are untouched");
    assert.deepEqual(after[1].results.slice(0, 6), was[1].results, "the hand-made orders are untouched");
    assert.deepEqual(after[2], was[2], "products keep their names and SKUs");
    assert.deepEqual(after[3], was[3], "the last sync is not moved to make the demo look fresh");

    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM orders").bind().first();
    assert.equal(n, 6 + summary.orders);
    const mismatched = await db
      .prepare("SELECT COUNT(*) AS n FROM orders o WHERE total_satang != (SELECT COALESCE(SUM(quantity * unit_price_satang), 0) FROM order_lines l WHERE l.order_id = o.id)")
      .bind()
      .first();
    assert.equal(mismatched.n, 0, "every order, hand-made ones included, has lines summing to its total");
    const late = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE placed_at > ?").bind(at).first();
    assert.equal(late.n, 0, "no history after the last sync, where no window would ever count it");

    // a cost someone already entered is kept; empty ones are filled; one stays uncosted
    const costs = Object.fromEntries(
      (await db.prepare("SELECT sku, unit_cost_satang AS cost FROM products").bind().all()).results.map((r) => [r.sku, r.cost])
    );
    assert.equal(costs["ML-TR-031"], 99900, "an existing cost is never overwritten");
    assert.equal(costs["ML-CV-018"], 25000);
    assert.equal(costs["ML-LN-012"], null);

    // and the dashboard reads it as the day the data is from
    const { listDashboardMetrics } = await import("../db/queries.ts");
    const metrics = await listDashboardMetrics(ownerSession);
    assert.equal(metrics.asOf.isToday, false);
    assert.ok(Number(metrics.periods["วันนี้"].orders.replace(/,/g, "")) > 50, "the anchor day is a busy day");
    assert.equal(metrics.periods["วันนี้"].partial, true);
    assert.notEqual(metrics.periods["30 วัน"].change, "—", "thirty days before the window exist to compare with");
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
});

/**
 * PIN-0031: the daily brief. Expected cards are worked out here in SQL, separately from
 * `db/brief.ts`, so a wrong rule cannot also be in the expectation.
 */
const staffSession = { userId: 2, shopId: 1, role: "staff", displayName: "ทดสอบ", pictureUrl: null };

async function withFreshDb(work) {
  const seeded = globalThis.__PINTO_TEST_ENV__;
  const db = createTestD1();
  globalThis.__PINTO_TEST_ENV__ = { DB: db };
  try {
    return await work(db);
  } finally {
    globalThis.__PINTO_TEST_ENV__ = seeded;
  }
}

async function anchorOf(db) {
  return Date.parse((await db.prepare("SELECT MAX(last_synced_at) AS at FROM channel_health").bind().first()).at);
}

test("the brief is computed from the shop's own rows, not typed in", async () => {
  await withFreshDb(async (db) => {
    const { listBrief } = await import("../db/brief.ts");
    const cards = await listBrief(ownerSession);
    const byKey = Object.fromEntries(cards.map((card) => [card.key, card]));

    // nothing from the old fixture survives
    const { n: seededActions } = await db.prepare("SELECT COUNT(*) AS n FROM actions").bind().first();
    assert.equal(seededActions, 0, "the four typed-in actions are gone (spec Q1)");
    for (const card of cards) assert.doesNotMatch(card.title, /ยกเลิกผิดปกติ|น้ำหนักเรียกเก็บ/);

    // review: count and value from the orders themselves
    const anchor = await anchorOf(db);
    const review = await db
      .prepare("SELECT COUNT(*) AS n, SUM(total_satang) AS v FROM orders WHERE status = 'ตรวจสอบ' AND placed_at <= ?")
      .bind(new Date(anchor).toISOString())
      .first();
    assert.equal(byKey["review:orders"].title, `${review.n} ออเดอร์รอตรวจสอบ`);
    assert.equal(byKey["review:orders"].amount, `มูลค่า ${baht(review.v)}`);

    // unread chats
    const unread = await db.prepare("SELECT SUM(unread_count) AS m, COUNT(*) AS c FROM conversations WHERE unread_count > 0").bind().first();
    assert.equal(byKey["chat:unread"].title, `${unread.m} ข้อความรอตอบ`);
    assert.equal(byKey["chat:unread"].amount, null, "no honest baht figure for unread chats (Q5)");

    // stock: days left = on hand ÷ units per day over the last seven days, computed here in SQL
    const vase = await db
      .prepare(
        "SELECT i.on_hand AS onHand, SUM(l.quantity) / 7.0 AS perDay FROM products p " +
          "JOIN inventory_levels i ON i.product_id = p.id JOIN order_lines l ON l.product_id = p.id " +
          "JOIN orders o ON o.id = l.order_id WHERE p.sku = 'ML-CV-018' AND o.placed_at >= ? AND o.placed_at <= ?"
      )
      .bind(new Date(anchor - 7 * 86_400_000).toISOString(), new Date(anchor).toISOString())
      .first();
    const days = vase.onHand / vase.perDay;
    assert.ok(days > 3 && days < 7, `the seed sizes the vase to about 3.5 days, got ${days}`);
    assert.match(byKey["stock:ML-CV-018"].title, new RegExp(`จะหมดในราว ${Number(days.toFixed(1))} วัน`));
    assert.equal(byKey["stock:ML-CV-018"].urgent, false, "over three days is not urgent");
    assert.equal(byKey["stock:ML-CL-006"].urgent, true, "out of stock is");
    assert.equal(byKey["stock:ML-TR-031"], undefined, "three weeks of stock raises nothing");

    // the Stock view reads the same computation, not the stored days_left
    const { listInventory } = await import("../db/queries.ts");
    const stockRow = (await listInventory(ownerSession)).find((item) => item.sku === "ML-CV-018");
    assert.equal(stockRow.daysLeft, Math.floor(days));

    // urgent cards come first, and every card says what it read
    const firstRelaxed = cards.findIndex((card) => !card.urgent);
    assert.ok(cards.slice(firstRelaxed).every((card) => !card.urgent), "urgent cards sort first");
    for (const card of cards) assert.ok(card.basis && card.consequence && card.cta.view, `${card.key} is incomplete`);
  });
});

test("owner-only cards never reach staff, and staff cannot snooze them", async () => {
  await withFreshDb(async () => {
    const { listBrief } = await import("../db/brief.ts");
    const owner = (await listBrief(ownerSession)).map((card) => card.key);
    const staff = (await listBrief(staffSession)).map((card) => card.key);
    assert.ok(owner.includes("cost:missing"), "the owner is told about the uncosted product");
    assert.ok(!staff.some((key) => /^(cost|ads):/.test(key)), `staff got ${staff.join(", ")}`);

    // in the payload too, not merely unrendered
    const staffHtml = await (await render("/", { cookie: await signIn("staff") })).text();
    assert.doesNotMatch(staffHtml, /cost:missing|ยังไม่มีต้นทุน/);

    const response = await fetchWorker("/api/actions/snooze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: await signIn("staff") },
      body: JSON.stringify({ key: "cost:missing" }),
    });
    assert.equal(response.status, 403);
  });
});

test("a card clears by itself when its data does", async () => {
  await withFreshDb(async (db) => {
    const { listBrief } = await import("../db/brief.ts");
    await db.exec(`
      UPDATE products SET unit_cost_satang = 24000 WHERE unit_cost_satang IS NULL;
      UPDATE conversations SET unread_count = 0;
      UPDATE orders SET status = 'พร้อมส่ง' WHERE status = 'ตรวจสอบ';
    `);
    const keys = (await listBrief(ownerSession)).map((card) => card.key);
    for (const gone of ["cost:missing", "chat:unread", "review:orders"]) {
      assert.ok(!keys.includes(gone), `${gone} should clear once its condition does`);
    }
  });
});

test("orders past the shop's pack window raise a card, by the shop's own rule", async () => {
  await withFreshDb(async (db) => {
    const { listBrief } = await import("../db/brief.ts");
    assert.ok(!(await listBrief(ownerSession)).some((card) => card.key === "pack:late"), "nothing is late in the seed");

    const anchor = await anchorOf(db);
    for (const [ext, hours, total] of [["LATE-1", 25, 120000], ["LATE-2", 30, 80000], ["FRESH-1", 2, 50000]]) {
      await db
        .prepare("INSERT INTO orders (shop_id,channel_id,external_id,customer_name,total_satang,status,placed_at) VALUES (1,1,?,'ทดสอบ',?,'รอแพ็ก',?)")
        .bind(ext, total, new Date(anchor - hours * 3_600_000).toISOString())
        .run();
    }
    const late = (await listBrief(ownerSession)).find((card) => card.key === "pack:late");
    assert.equal(late.title, "2 ออเดอร์รอแพ็กเกิน 24 ชม.", "only the two older than 24 h");
    assert.equal(late.amount, "มูลค่า ฿2,000");
    assert.match(late.basis, /ตามที่ร้านตั้งไว้/, "labelled as the shop's rule, not a platform's");

    await db.prepare("UPDATE shops SET pack_window_hours = 48").bind().run();
    assert.ok(!(await listBrief(ownerSession)).some((card) => card.key === "pack:late"), "a wider window clears it");
  });
});

test("ad spend unusually high for its sales raises a card for the owner", async () => {
  await withFreshDb(async (db) => {
    const { listBrief } = await import("../db/brief.ts");
    assert.ok(!(await listBrief(ownerSession)).some((card) => card.key.startsWith("ads:")), "the seed's spend is steady");

    // double TikTok's spend on the last full day before the anchor
    const anchor = await anchorOf(db);
    const yesterday = new Date(anchor + 7 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
    const { changes } = (await db
      .prepare("UPDATE ad_spend_daily SET spend_satang = spend_satang * 2 WHERE day = ? AND channel_id = (SELECT id FROM channels WHERE code = 'tiktok')")
      .bind(yesterday)
      .run()).meta;
    assert.equal(changes, 1);

    const ads = (await listBrief(ownerSession)).find((card) => card.key.startsWith("ads:"));
    assert.ok(ads, "doubling spend against unchanged sales should be flagged");
    assert.equal(ads.title, "ค่าโฆษณา TikTok Shop สูงกว่าปกติ");
    assert.ok(!(await listBrief(staffSession)).some((card) => card.key.startsWith("ads:")));
  });
});

/**
 * PIN-0028: cost per unit, edited on Stock by the owner. A cost change reaches future lines
 * only; the one exception is a product's first cost filling the past lines that had none.
 */
async function postCost(sku, body, as = "owner") {
  return fetchWorker(`/api/products/${sku}/cost`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(as ? { cookie: await signIn(as) } : {}) },
    body: JSON.stringify(body),
  });
}

const costsOf = async (db, sku) =>
  (await db
    .prepare("SELECT l.unit_cost_satang AS cost, COUNT(*) AS n FROM order_lines l JOIN products p ON p.id = l.product_id WHERE p.sku = ? GROUP BY 1 ORDER BY 1")
    .bind(sku)
    .all()).results.map((row) => ({ cost: row.cost, n: row.n }));

test("cost reaches the owner's payload and never staff's", async () => {
  await withFreshDb(async () => {
    const owner = await (await render("/", { cookie: await signIn("owner") })).text();
    const staff = await (await render("/", { cookie: await signIn("staff") })).text();
    assert.match(owner, /unitCostSatang/, "the owner's inventory carries cost");
    assert.doesNotMatch(staff, /unitCostSatang|uncostedLines/, "staff's carries none at all");
  });
});

test("the cost route refuses everyone but the owner, and anything that is not a cost", async () => {
  await withFreshDb(async (db) => {
    const before = JSON.stringify((await db.prepare("SELECT sku, unit_cost_satang FROM products ORDER BY id").bind().all()).results);

    assert.equal((await postCost("ML-LN-012", { cost: "240" }, null)).status, 401, "no session");
    const staff = await postCost("ML-LN-012", { cost: "240" }, "staff");
    assert.equal(staff.status, 403, "staff, refused on the server");

    for (const cost of ["-5", "abc", "1e3", "1.234", "250,00", "0", 0, "2000000", null, ""]) {
      const response = await postCost("ML-LN-012", { cost });
      assert.equal(response.status, 400, `${JSON.stringify(cost)} should be refused`);
      assert.ok((await response.json()).error, "with a message");
    }
    assert.equal((await postCost("ML-LN-012", { cost: "240", fillPast: "yes" })).status, 400, "fillPast must be a boolean");
    assert.equal((await postCost("ML-XX-999", { cost: "240" })).status, 404, "unknown SKU");
    assert.equal((await postCost("bad%20sku", { cost: "240" })).status, 400, "malformed SKU");

    const after = JSON.stringify((await db.prepare("SELECT sku, unit_cost_satang FROM products ORDER BY id").bind().all()).results);
    assert.equal(after, before, "no refused request changed a cost");
  });
});

test("changing a cost changes future lines only — existing lines keep their snapshot", async () => {
  await withFreshDb(async (db) => {
    const lines = await costsOf(db, "ML-CV-018");
    assert.deepEqual(lines.map((row) => row.cost), [25000], "every vase line was recorded at ฿250");

    const response = await postCost("ML-CV-018", { cost: "300.50" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { saved: true, unitCostSatang: 30050, filled: 0 });

    const { cost } = await db.prepare("SELECT unit_cost_satang AS cost FROM products WHERE sku = 'ML-CV-018'").bind().first();
    assert.equal(cost, 30050, "the product takes the new cost");
    assert.deepEqual(await costsOf(db, "ML-CV-018"), lines, "no existing line was rewritten");

    // and a product that already has a cost cannot use the one-time fill
    assert.equal((await postCost("ML-CV-018", { cost: "310", fillPast: true })).status, 409);
    assert.equal((await db.prepare("SELECT unit_cost_satang AS c FROM products WHERE sku = 'ML-CV-018'").bind().first()).c, 30050);
  });
});

test("a product's first cost fills the past lines that had none — once", async () => {
  await withFreshDb(async (db) => {
    const [{ n: missing }] = (await costsOf(db, "ML-LN-012")).filter((row) => row.cost === null);
    assert.ok(missing > 100, "linen is uncosted across its whole history");

    const response = await postCost("ML-LN-012", { cost: 240, fillPast: true });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).filled, missing, "every uncosted line, and only those");
    assert.deepEqual(await costsOf(db, "ML-LN-012"), [{ cost: 24000, n: missing }]);

    // coverage is now complete, and the brief's missing-cost card clears by itself
    const { listDashboardMetrics } = await import("../db/queries.ts");
    const { listBrief } = await import("../db/brief.ts");
    assert.equal((await listDashboardMetrics(ownerSession)).periods["30 วัน"].coverage, "100%");
    assert.ok(!(await listBrief(ownerSession)).some((card) => card.key === "cost:missing"));

    // a second fill is refused: the product has a cost now
    assert.equal((await postCost("ML-LN-012", { cost: 250, fillPast: true })).status, 409);
  });
});

test("a first cost without the fill leaves history as it was", async () => {
  await withFreshDb(async (db) => {
    const before = await costsOf(db, "ML-LN-012");
    const response = await postCost("ML-LN-012", { cost: "240" });
    assert.equal((await response.json()).filled, 0);
    assert.deepEqual(await costsOf(db, "ML-LN-012"), before, "past lines stay uncosted unless asked");
  });
});

/** PIN-0032: the new-seller checklist. Ticks come from data; only "ปิด" is stored. */
const CHECKLIST = /อีกนิดเดียวก็เห็นกำไรจริงของร้าน/;
const progressOf = (html) => stripComments(html).match(/ทำแล้ว (\d) จาก 2 ขั้น/)?.[1];

test("the checklist is the owner's, and its ticks are read from data", async () => {
  await withFreshDb(async (db) => {
    const owner = await (await render("/", { cookie: await signIn("owner") })).text();
    assert.match(owner, CHECKLIST);
    assert.equal(progressOf(owner), "1", "a channel has synced; the linen is uncosted");
    assert.doesNotMatch(await (await render("/", { cookie: await signIn("staff") })).text(), CHECKLIST, "staff never get it");

    // no sync at all: neither step is done
    await db.prepare("UPDATE channel_health SET last_synced_at = NULL").bind().run();
    assert.equal(progressOf(await (await render("/", { cookie: await signIn("owner") })).text()), "0");
  });
});

test("the checklist goes once the shop is connected and fully costed", async () => {
  await withFreshDb(async () => {
    const response = await postCost("ML-LN-012", { cost: 240, fillPast: true });
    assert.equal(response.status, 200);
    assert.doesNotMatch(await (await render("/", { cookie: await signIn("owner") })).text(), CHECKLIST);
  });
});

test("closing the checklist is stored for good, and only an owner can", async () => {
  await withFreshDb(async (db) => {
    const staff = await fetchWorker("/api/actions/snooze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: await signIn("staff") },
      body: JSON.stringify({ key: "checklist:onboarding" }),
    });
    assert.equal(staff.status, 403);

    const cookie = await signIn("owner");
    const response = await fetchWorker("/api/actions/snooze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ key: "checklist:onboarding" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).until, "9999-12-31T00:00:00.000Z", "not until tomorrow, like a card");
    assert.doesNotMatch(await (await render("/", { cookie })).text(), CHECKLIST);

    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM action_snoozes WHERE card_key = 'checklist:onboarding'").bind().first();
    assert.equal(n, 1);
  });
});

test("staff never receive finance data, owners do", async () => {
  const ownerHtml = await (await render("/", { cookie: await signIn("owner") })).text();
  const staffHtml = await (await render("/", { cookie: await signIn("staff") })).text();

  const navOf = (html) => [...html.matchAll(/<em>([^<]+)<\/em>/g)].map((m) => m[1]);
  assert.ok(navOf(ownerHtml).includes("การเงิน"), "owner keeps the Money nav item");
  assert.ok(!navOf(staffHtml).includes("การเงิน"), "staff must not see the Money nav item");

  // the real enforcement: the numbers are absent from the payload, not merely unrendered,
  // because AppShell is a client component and anything sent to it is readable
  // The waterfall's figures are computed now (PIN-0027), so read them rather than pin them.
  const { listDashboardMetrics } = await import("../db/queries.ts");
  const owner = await listDashboardMetrics({ userId: 1, shopId: 1, role: "owner", displayName: "ทดสอบ", pictureUrl: null });
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const waterfallSales = new RegExp(escape(owner.waterfall[0].amount));

  for (const secret of [/฿38,740/, /฿24,680/, waterfallSales]) {
    assert.match(ownerHtml, secret, "owner should see finance figures");
    assert.doesNotMatch(staffHtml, secret, "finance figures must not reach staff at all");
  }

  // performance data is deliberately kept for both — stripping it would gut the dashboard.
  // That includes today's profit: PIN-0013 drew the line at money movement, not performance.
  const todayProfit = new RegExp(escape(owner.periods["วันนี้"].profit));
  for (const shared of [/TT-10842/, todayProfit]) {
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
