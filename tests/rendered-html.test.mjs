import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createTestD1 } from "./support/d1.mjs";

// The page is a server component that reads D1. `resolve-hooks.mjs` (loaded via
// --import) points `cloudflare:workers` at a stub reading this global.
globalThis.__PINTO_TEST_ENV__ = { DB: createTestD1() };

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function post(pathname, body) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
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
  assert.match(html, /property="og:image" content="http:\/\/localhost\/og-v2\.png"/i);
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.match(html, /name="twitter:image" content="http:\/\/localhost\/og-v2\.png"/i);
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
  globalThis.__PINTO_TEST_ENV__ = { DB: createTestD1({ seed: false }) };
  try {
    const response = await render();
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
