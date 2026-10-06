/**
 * Brings the deployed database up to PIN-0027 without deleting anything (PIN-0029).
 *
 * เกรพ chose this over `npm run db:remote:seed -- --force`, which would DELETE every user —
 * including the granted LINE account. What this does instead, in order:
 *
 * 1. **Reads** the target and refuses unless it looks exactly like a pre-PIN-0026 seed: one
 *    shop, only the six hand-made orders, every SKU and channel the history needs, a last
 *    sync to anchor to, and no order lines or ad spend yet (so it never runs twice).
 * 2. Prints what it would write. `--dry-run` stops here and leaves the SQL in a temp file.
 * 3. Asks for the database name, then records a **Time Travel bookmark** — the point to
 *    restore to if anything after it goes wrong.
 * 4. Applies the pending migrations (0006, 0007: a new column and two new tables).
 * 5. Executes `scripts/backfill-history.ts`'s SQL — additive only; see that file.
 * 6. Checks the result: every order's lines sum to its total, nothing lands after the last
 *    sync, and the users table has exactly the rows it had before.
 *
 * Usage: npm run db:remote:backfill [-- --dry-run]
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { prompt } from "./prompt.mjs";
import { readJsonc } from "./read-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = join(root, "wrangler.deploy.jsonc");
const { d1_databases: databases } = readJsonc(config);
const target = databases.find((entry) => entry.binding === "DB");
const name = target?.database_name;
const SHOP_ID = 1;
const HAND_MADE = ["TT-10842", "SP-48219", "TT-10841", "LN-39204", "SP-48218", "TT-10840"];
const SKUS = ["ML-CV-018", "ML-CL-006", "ML-AG-024", "ML-LN-012", "ML-TR-031"];
const CHANNELS = ["tiktok", "shopee", "line"];

if (!name) {
  console.error("wrangler.deploy.jsonc has no DB binding.");
  process.exit(1);
}

const wrangler = (args) =>
  execFileSync("npx", ["wrangler", ...args], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** One read query against the remote database -> rows. */
function query(sql) {
  const out = wrangler(["d1", "execute", name, "--remote", "-c", config, "--command", sql, "--json"]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

const quoteList = (values) => values.map((value) => `'${value}'`).join(", ");

function refuse(reason) {
  console.error(`\nRefusing: ${reason}\nNothing was written.`);
  process.exit(1);
}

// ---------------------------------------------------------------- 1. read the target
console.log(`Reading "${name}"…`);
const tables = new Set(query("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));
const [state] = query(
  `SELECT
     (SELECT COUNT(*) FROM shops) AS shops,
     (SELECT COUNT(*) FROM shops WHERE id = ${SHOP_ID}) AS ourShop,
     (SELECT COUNT(*) FROM orders) AS orders,
     (SELECT COUNT(*) FROM orders WHERE shop_id = ${SHOP_ID} AND external_id IN (${quoteList(HAND_MADE)})) AS handMade,
     (SELECT COUNT(*) FROM products WHERE shop_id = ${SHOP_ID} AND sku IN (${quoteList(SKUS)})) AS skus,
     (SELECT COUNT(*) FROM channels WHERE shop_id = ${SHOP_ID} AND code IN (${quoteList(CHANNELS)})) AS channels,
     (SELECT COUNT(*) FROM users) AS users,
     (SELECT MAX(last_synced_at) FROM channel_health WHERE shop_id = ${SHOP_ID}) AS anchor`
);

if (state.shops !== 1 || state.ourShop !== 1) refuse(`expected exactly one shop with id ${SHOP_ID}, found ${state.shops}.`);
if (state.orders !== state.handMade) {
  refuse(
    `the database has ${state.orders} orders, of which ${state.handMade} are the hand-made ones.\n` +
      "Generated ids could collide with orders this script does not know about."
  );
}
if (state.skus !== SKUS.length) refuse(`expected all ${SKUS.length} demo SKUs, found ${state.skus}.`);
if (state.channels !== CHANNELS.length) refuse(`expected channels ${CHANNELS.join(", ")}, found ${state.channels}.`);
if (!state.anchor) refuse("no channel has a last_synced_at, so there is nothing to anchor the history to.");

for (const table of ["order_lines", "ad_spend_daily"]) {
  if (!tables.has(table)) continue;
  const [{ n }] = query(`SELECT COUNT(*) AS n FROM ${table} WHERE shop_id = ${SHOP_ID}`);
  if (n > 0) refuse(`${table} already has ${n} row(s) — this database has been backfilled (or seeded) already.`);
}

const anchor = new Date(state.anchor);
const [{ reserved }] = query(
  `SELECT COUNT(*) AS reserved FROM orders WHERE shop_id = ${SHOP_ID}
     AND date(placed_at, '+7 hours') = date('${anchor.toISOString()}', '+7 hours')
     AND placed_at <= '${anchor.toISOString()}'`
);

// ---------------------------------------------------------------- 2. say what it will do
const { backfillSql } = await import("./backfill-history.ts");
const { sql, summary } = backfillSql({ shopId: SHOP_ID, anchor, reservedToday: reserved });
const sqlPath = join(tmpdir(), `pinto-backfill-${process.pid}.sql`);
writeFileSync(sqlPath, sql);

const pending = ["order_lines", "ad_spend_daily"].filter((table) => !tables.has(table));
console.log(`
  database        ${name} (shop ${SHOP_ID}, ${state.users} user(s), ${state.orders} order(s))
  last sync       ${anchor.toISOString()} — the history ends here, not at today
  migrations      ${pending.length ? `pending: creates ${pending.join(", ")}` : "already applied"}
  will insert     ${summary.orders.toLocaleString("en-US")} orders, ${summary.lines.toLocaleString("en-US")} order lines, ${summary.adDays} ad-spend days
  date range      ${summary.oldest} → ${summary.newest}
  will update     product costs where they are empty (one SKU stays uncosted on purpose)
  will delete     nothing
`);

if (process.argv.includes("--dry-run")) {
  console.log(`Dry run. The SQL is at ${sqlPath} — nothing was written.`);
  process.exit(0);
}

// ---------------------------------------------------------------- 3. confirm, and a way back
const typed = await prompt(`Type the database name to write to it (${name}): `);
if (typed !== name) {
  unlinkSync(sqlPath);
  refuse("the name did not match.");
}

const { bookmark } = JSON.parse(wrangler(["d1", "time-travel", "info", name, "-c", config, "--json"]));
console.log(`\nRestore point recorded. To undo everything below:\n  npx wrangler d1 time-travel restore ${name} --bookmark=${bookmark} -c wrangler.deploy.jsonc\n`);

try {
  // ------------------------------------------------------------ 4. migrations
  if (pending.length) {
    console.log("Applying migrations…");
    console.log(wrangler(["d1", "migrations", "apply", name, "--remote", "-c", config]).split("\n").filter((line) => /✅|applied|0006|0007/.test(line)).join("\n"));
  }

  // ------------------------------------------------------------ 5. the backfill
  console.log("Writing the history…");
  const out = wrangler(["d1", "execute", name, "--remote", "-c", config, "--file", sqlPath, "--yes"]);
  console.log(out.split("\n").filter((line) => line.trim()).slice(-3).join("\n"));
} finally {
  unlinkSync(sqlPath);
}

// ---------------------------------------------------------------- 6. check it
const [after] = query(
  `SELECT
     (SELECT COUNT(*) FROM orders WHERE shop_id = ${SHOP_ID}) AS orders,
     (SELECT COUNT(*) FROM order_lines WHERE shop_id = ${SHOP_ID}) AS lines,
     (SELECT COUNT(*) FROM ad_spend_daily WHERE shop_id = ${SHOP_ID}) AS adDays,
     (SELECT COUNT(*) FROM users) AS users,
     (SELECT COUNT(*) FROM orders o WHERE o.shop_id = ${SHOP_ID} AND o.total_satang !=
        (SELECT COALESCE(SUM(quantity * unit_price_satang), 0) FROM order_lines l WHERE l.order_id = o.id)) AS mismatched,
     (SELECT COUNT(*) FROM orders WHERE shop_id = ${SHOP_ID} AND placed_at > '${anchor.toISOString()}') AS afterAnchor`
);

const problems = [];
if (after.orders !== state.orders + summary.orders) problems.push(`orders: expected ${state.orders + summary.orders}, found ${after.orders}`);
if (after.lines !== summary.lines) problems.push(`order lines: expected ${summary.lines}, found ${after.lines}`);
if (after.adDays !== summary.adDays) problems.push(`ad-spend days: expected ${summary.adDays}, found ${after.adDays}`);
if (after.users !== state.users) problems.push(`users: had ${state.users}, now ${after.users}`);
if (after.mismatched !== 0) problems.push(`${after.mismatched} order(s) whose lines do not sum to their total`);
if (after.afterAnchor !== 0) problems.push(`${after.afterAnchor} order(s) placed after the last sync`);

if (problems.length) {
  console.error(`\nThe backfill wrote, but the result is not what was expected:\n  - ${problems.join("\n  - ")}`);
  console.error(`\nRestore with:\n  npx wrangler d1 time-travel restore ${name} --bookmark=${bookmark} -c wrangler.deploy.jsonc`);
  process.exit(1);
}

console.log(
  `\nDone. ${after.orders.toLocaleString("en-US")} orders, ${after.lines.toLocaleString("en-US")} lines, ` +
    `${after.adDays} ad-spend days; ${after.users} user(s), unchanged. Every order's lines sum to its total.\n` +
    "Deploy the PIN-0027 code next: npm run deploy"
);
