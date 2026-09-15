import assert from "node:assert/strict";
import test from "node:test";

import { createTestD1 } from "./support/d1.mjs";

/**
 * LINE Login (PIN-0014).
 *
 * The network is stubbed rather than reached: these assert Pinto's own decisions — what it
 * sends people to, what it refuses, and what it refuses to do to the database — not that
 * LINE's servers work.
 */

const db = createTestD1();
const CONFIG = {
  LINE_CHANNEL_ID: "2011580015",
  LINE_CHANNEL_SECRET: "test-secret-never-a-real-one",
  LINE_CALLBACK_URL: "http://localhost:5173/api/auth/line/callback",
};
globalThis.__PINTO_TEST_ENV__ = { DB: db, ...CONFIG };

async function fetchWorker(pathname, init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      method: init.method ?? "GET",
      headers: { accept: "text/html", host: "localhost", ...(init.headers ?? {}) },
      redirect: "manual",
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const sessionCount = async () =>
  Number((await db.prepare("SELECT COUNT(*) AS n FROM sessions").bind().first()).n);

/** Intercepts only LINE's endpoints; anything else still reaches the real fetch. */
function stubLine(handlers) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (url.includes(fragment)) return handler(init);
    }
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}

const withoutConfig = async (run) => {
  const saved = globalThis.__PINTO_TEST_ENV__;
  globalThis.__PINTO_TEST_ENV__ = { DB: db };
  try {
    return await run();
  } finally {
    globalThis.__PINTO_TEST_ENV__ = saved;
  }
};

test("start sends the browser to LINE with a state and nonce it can prove later", async () => {
  const response = await fetchWorker("/api/auth/line/start");
  assert.equal(response.status, 302);

  const target = new URL(response.headers.get("location"));
  assert.equal(target.origin + target.pathname, "https://access.line.me/oauth2/v2.1/authorize");
  assert.equal(target.searchParams.get("response_type"), "code");
  assert.equal(target.searchParams.get("client_id"), CONFIG.LINE_CHANNEL_ID);
  assert.equal(target.searchParams.get("redirect_uri"), CONFIG.LINE_CALLBACK_URL);
  assert.equal(target.searchParams.get("scope"), "openid profile");

  const cookies = response.headers.getSetCookie();
  const state = cookies.find((c) => c.startsWith("pinto_line_state="));
  const nonce = cookies.find((c) => c.startsWith("pinto_line_nonce="));
  assert.ok(state && nonce, "both one-shot cookies must be issued");
  for (const cookie of [state, nonce]) {
    assert.match(cookie, /HttpOnly/, "script must not be able to read it");
    assert.match(cookie, /SameSite=Lax/);
  }

  // The value in the cookie is the value LINE is asked to echo back.
  assert.equal(state.split(";")[0].split("=")[1], target.searchParams.get("state"));
  assert.equal(nonce.split(";")[0].split("=")[1], target.searchParams.get("nonce"));

  // Never send the secret to the browser.
  assert.doesNotMatch(response.headers.get("location"), /test-secret/);
});

test("a second attempt gets a different state, so one cannot be replayed", async () => {
  const first = await fetchWorker("/api/auth/line/start");
  const second = await fetchWorker("/api/auth/line/start");
  const stateOf = (r) =>
    new URL(r.headers.get("location")).searchParams.get("state");
  assert.notEqual(stateOf(first), stateOf(second));
});

test("start refuses when the channel is not configured", async () => {
  const response = await withoutConfig(() => fetchWorker("/api/auth/line/start"));
  assert.equal(response.status, 503);
});

test("the callback rejects a forged state before touching the database", async () => {
  const before = await sessionCount();

  const noCookie = await fetchWorker("/api/auth/line/callback?code=abc&state=whatever");
  assert.equal(noCookie.status, 400);

  const mismatched = await fetchWorker("/api/auth/line/callback?code=abc&state=attacker", {
    headers: { cookie: "pinto_line_state=issued; pinto_line_nonce=n" },
  });
  assert.equal(mismatched.status, 400);

  assert.equal(await sessionCount(), before, "no session may be created for a forged callback");
});

test("the callback reports LINE's own refusal instead of a stack trace", async () => {
  const response = await fetchWorker("/api/auth/line/callback?error=access_denied&state=s", {
    headers: { cookie: "pinto_line_state=s; pinto_line_nonce=n" },
  });
  assert.equal(response.status, 400);
  const html = await response.text();
  assert.match(html, /ยกเลิกการอนุญาต/, "it should say what happened, in Thai");
});

test("a LINE account with no user row is refused, and no session is created", async () => {
  const restore = stubLine({
    "oauth2/v2.1/token": async () => Response.json({ id_token: "fake.id.token" }),
    "oauth2/v2.1/verify": async () =>
      Response.json({ sub: "Udeadbeefdeadbeefdeadbeefdeadbeef", name: "คนแปลกหน้า" }),
  });
  try {
    const before = await sessionCount();
    const response = await fetchWorker("/api/auth/line/callback?code=abc&state=s", {
      headers: { cookie: "pinto_line_state=s; pinto_line_nonce=n" },
    });

    assert.equal(response.status, 403, "an unknown identity must not be provisioned a shop");
    assert.equal(await sessionCount(), before, "and must not receive a session");

    const html = await response.text();
    assert.match(html, /Udeadbeefdeadbeefdeadbeefdeadbeef/, "shows the caller their own id");
    assert.doesNotMatch(html, /test-secret/, "never leaks the channel secret");
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /pinto_session=\w/);
  } finally {
    restore();
  }
});


test("signing in replaces the placeholder name the grant script wrote", async () => {
  // `grant-line-access.mjs` has only a LINE user id to go on, so it writes a placeholder.
  // Until PIN-0014's follow-up this was never replaced, and the script said it would be.
  const lineId = "Ucccc1111dddd2222eeee3333ffff4444";
  await db
    .prepare(
      "INSERT INTO users (shop_id, provider, provider_user_id, display_name, picture_url, role, created_at)" +
        " VALUES (1, 'line', ?, 'ผู้ใช้ LINE', NULL, 'owner', '2026-09-11T00:00:00.000Z')",
    )
    .bind(lineId)
    .run();

  const restore = stubLine({
    "oauth2/v2.1/token": async () => Response.json({ id_token: "fake.id.token" }),
    "oauth2/v2.1/verify": async () =>
      Response.json({ sub: lineId, name: "เกรพ ธนพัฒน์", picture: "https://profile.line-scdn.net/x" }),
  });
  try {
    const response = await fetchWorker("/api/auth/line/callback?code=abc&state=s", {
      headers: { cookie: "pinto_line_state=s; pinto_line_nonce=n" },
    });
    assert.equal(response.status, 303);

    const row = await db
      .prepare("SELECT display_name AS name, picture_url AS picture FROM users WHERE provider_user_id = ?")
      .bind(lineId)
      .first();
    assert.equal(row.name, "เกรพ ธนพัฒน์", "the placeholder must be replaced by LINE's own name");
    assert.equal(row.picture, "https://profile.line-scdn.net/x");
  } finally {
    restore();
  }
});

test("a later rename on LINE does not leave a stale name in Pinto", async () => {
  const lineId = "U5555666677778888999900001111aaaa";
  await db
    .prepare(
      "INSERT INTO users (shop_id, provider, provider_user_id, display_name, role, created_at)" +
        " VALUES (1, 'line', ?, 'ชื่อเก่า', 'staff', '2026-09-11T00:00:00.000Z')",
    )
    .bind(lineId)
    .run();

  const restore = stubLine({
    "oauth2/v2.1/token": async () => Response.json({ id_token: "fake.id.token" }),
    "oauth2/v2.1/verify": async () => Response.json({ sub: lineId, name: "ชื่อใหม่" }),
  });
  try {
    await fetchWorker("/api/auth/line/callback?code=abc&state=s", {
      headers: { cookie: "pinto_line_state=s; pinto_line_nonce=n" },
    });
    const row = await db
      .prepare("SELECT display_name AS name, role FROM users WHERE provider_user_id = ?")
      .bind(lineId)
      .first();
    assert.equal(row.name, "ชื่อใหม่");
    // Refreshing the profile must not touch anything Pinto owns.
    assert.equal(row.role, "staff", "the role is Pinto's, not LINE's");
  } finally {
    restore();
  }
});

test("a known LINE user is signed in with a real session", async () => {
  const lineId = "Uaaaabbbbccccddddeeeeffff00001111";
  await db
    .prepare(
      "INSERT INTO users (shop_id, provider, provider_user_id, display_name, role, created_at)" +
        " VALUES (1, 'line', ?, 'เกรพ', 'owner', '2026-09-11T00:00:00.000Z')",
    )
    .bind(lineId)
    .run();

  const restore = stubLine({
    "oauth2/v2.1/token": async () => Response.json({ id_token: "fake.id.token" }),
    "oauth2/v2.1/verify": async () => Response.json({ sub: lineId, name: "เกรพ" }),
  });
  try {
    const before = await sessionCount();
    const response = await fetchWorker("/api/auth/line/callback?code=abc&state=s", {
      headers: { cookie: "pinto_line_state=s; pinto_line_nonce=n" },
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/");
    assert.equal(await sessionCount(), before + 1);

    const cookies = response.headers.getSetCookie();
    const session = cookies.find((c) => c.startsWith("pinto_session="));
    assert.ok(session, "a session cookie must be set");
    assert.match(session, /HttpOnly/);

    // The one-shot cookies are spent, so this callback cannot be replayed.
    assert.ok(cookies.some((c) => /^pinto_line_state=;.*Max-Age=0/.test(c)));
    assert.ok(cookies.some((c) => /^pinto_line_nonce=;.*Max-Age=0/.test(c)));

    // The database stores the digest, never the cookie value (PIN-0011's rule still holds).
    const raw = session.split(";")[0].split("=")[1];
    const stored = await db.prepare("SELECT id FROM sessions ORDER BY rowid DESC LIMIT 1").bind().first();
    assert.notEqual(stored.id, raw, "the raw token must never be stored");
  } finally {
    restore();
  }
});

test("the refusal page's button is sized to its text, not to a stray min-height", async () => {
  const html = await (await fetchWorker("/api/auth/line/callback?code=x&state=nope")).text();

  // These pages carry their own CSS and no reset, so `box-sizing` is `content-box` unless it
  // is set. It was not, and a 44px min-height plus 12px of vertical padding rendered a 68px
  // button with its label pinned to the top — เกรพ saw it in production and asked why.
  const rule = html.match(/\sa \{[^}]*\}/);
  assert.ok(rule, "the page should style its link as a button");
  assert.match(rule[0], /box-sizing:\s*border-box/, "without this the padding is added to the height");
  assert.match(rule[0], /min-height:\s*44px/, "the tap target the design system asks for");
  assert.doesNotMatch(rule[0], /padding:\s*\d+px \d+px/, "vertical padding would grow it past 44px again");
});

test("the login page offers LINE only when the channel is configured", async () => {
  const ready = await (await fetchWorker("/login")).text();
  assert.match(ready, /href="\/api\/auth\/line\/start"/, "a live link when configured");
  assert.doesNotMatch(ready, /ยังไม่ได้เชื่อมต่อ LINE Login/);

  const notReady = await withoutConfig(async () => (await fetchWorker("/login")).text());
  assert.match(notReady, /ยังไม่ได้เชื่อมต่อ LINE Login/, "honest when it is not");
  assert.doesNotMatch(notReady, /href="\/api\/auth\/line\/start"/);
});
