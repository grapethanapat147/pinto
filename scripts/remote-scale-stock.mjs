/**
 * Takes the deployed database to PIN-0031 (spec `.codex/specs/daily-brief.md`, Q3 and Q6).
 *
 * Two changes, both needed before the PIN-0031 code is deployed:
 * 1. Migration 0008 — the `action_snoozes` table and `shops.pack_window_hours`. Additive.
 * 2. Stock sized to the sales PIN-0029 put beside it. Production still holds the small shop's
 *    `on_hand` (tray 112, vase 42…) next to ~280 orders a day, so computed days-left would
 *    read every product as empty. This **updates existing rows** — unlike the backfill — so:
 *    it refuses unless every row still holds the original seeded value (it never overwrites
 *    a number someone changed), writes each row only `WHERE on_hand = <that value>`, and
 *    records a Time Travel bookmark first.
 *
 * Usage: npm run db:remote:scale-stock [-- --dry-run]
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
const name = readJsonc(config).d1_databases.find((entry) => entry.binding === "DB")?.database_name;
const SHOP_ID = 1;

if (!name) {
  console.error("wrangler.deploy.jsonc has no DB binding.");
  process.exit(1);
}

const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { cwd: root, encoding: "utf8" });
function query(sql) {
  const out = wrangler(["d1", "execute", name, "--remote", "-c", config, "--command", sql, "--json"]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}
function refuse(reason) {
  console.error(`\nRefusing: ${reason}\nNothing was written.`);
  process.exit(1);
}

const { inventory } = await import("../app/fixtures/inventory.ts");
const { stockForDays } = await import("./generate-history.ts");

// ---------------------------------------------------------------- read
console.log(`Reading "${name}"…`);
const tables = new Set(query("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));
const [{ at }] = query(`SELECT MAX(last_synced_at) AS at FROM channel_health WHERE shop_id = ${SHOP_ID}`);
if (!at) refuse("no channel has synced, so there is no week of sales to size stock from.");
const anchor = Date.parse(at);
const weekAgo = new Date(anchor - 7 * 86_400_000).toISOString();

const current = new Map(
  query(
    `SELECT p.sku, i.on_hand AS onHand FROM inventory_levels i JOIN products p ON p.id = i.product_id
     WHERE i.shop_id = ${SHOP_ID}`
  ).map((row) => [row.sku, row.onHand])
);
const sold = new Map(
  query(
    `SELECT p.sku, SUM(l.quantity) AS units FROM order_lines l
       JOIN orders o ON o.id = l.order_id JOIN products p ON p.id = l.product_id
     WHERE o.shop_id = ${SHOP_ID} AND o.placed_at >= '${weekAgo}' AND o.placed_at <= '${new Date(anchor).toISOString()}'
     GROUP BY p.sku`
  ).map((row) => [row.sku, Number(row.units)])
);

const changed = inventory.filter((item) => current.get(item.sku) !== item.stock);
if (changed.length) {
  refuse(
    "stock no longer matches the original seed, so someone has changed it:\n" +
      changed.map((item) => `  ${item.sku}: seed ${item.stock}, now ${current.get(item.sku) ?? "missing"}`).join("\n")
  );
}
if (!sold.size) refuse("no sales in the week before the last sync — run the PIN-0029 backfill first.");

const plan = inventory
  .map((item) => ({ sku: item.sku, from: item.stock, to: stockForDays(sold.get(item.sku) ?? 0, item.daysLeft ?? 0) }))
  .filter((row) => row.to !== row.from);

const pending = ["action_snoozes"].filter((table) => !tables.has(table));
console.log(`
  database      ${name} (shop ${SHOP_ID}), sales week ending ${new Date(anchor).toISOString()}
  migrations    ${pending.length ? "pending: 0008 (action_snoozes, shops.pack_window_hours)" : "already applied"}
  stock         ${plan.map((row) => `${row.sku} ${row.from} → ${row.to}`).join("\n                ")}
  will delete   nothing
`);

const sql = plan
  .map(
    (row) =>
      `UPDATE inventory_levels SET on_hand = ${row.to} WHERE shop_id = ${SHOP_ID} AND on_hand = ${row.from} ` +
      `AND product_id = (SELECT id FROM products WHERE shop_id = ${SHOP_ID} AND sku = '${row.sku}');`
  )
  .join("\n");

if (process.argv.includes("--dry-run")) {
  console.log(`Dry run — nothing was written.\n\n${sql}`);
  process.exit(0);
}

// ---------------------------------------------------------------- confirm, and a way back
if ((await prompt(`Type the database name to write to it (${name}): `)) !== name) refuse("the name did not match.");
const { bookmark } = JSON.parse(wrangler(["d1", "time-travel", "info", name, "-c", config, "--json"]));
console.log(`\nRestore point recorded. To undo everything below:\n  npx wrangler d1 time-travel restore ${name} --bookmark=${bookmark} -c wrangler.deploy.jsonc\n`);

if (pending.length) {
  console.log("Applying migrations…");
  wrangler(["d1", "migrations", "apply", name, "--remote", "-c", config]);
}

const sqlPath = join(tmpdir(), `pinto-scale-stock-${process.pid}.sql`);
writeFileSync(sqlPath, sql);
try {
  wrangler(["d1", "execute", name, "--remote", "-c", config, "--file", sqlPath, "--yes"]);
} finally {
  unlinkSync(sqlPath);
}

// ---------------------------------------------------------------- check
const after = new Map(
  query(
    `SELECT p.sku, i.on_hand AS onHand FROM inventory_levels i JOIN products p ON p.id = i.product_id WHERE i.shop_id = ${SHOP_ID}`
  ).map((row) => [row.sku, row.onHand])
);
const wrong = plan.filter((row) => after.get(row.sku) !== row.to);
const hasSnoozes = query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'action_snoozes'").length === 1;
if (wrong.length || !hasSnoozes) {
  console.error(`\nNot what was expected: ${wrong.map((row) => `${row.sku} is ${after.get(row.sku)}, not ${row.to}`).join("; ")}${hasSnoozes ? "" : " action_snoozes is missing"}`);
  console.error(`Restore with:\n  npx wrangler d1 time-travel restore ${name} --bookmark=${bookmark} -c wrangler.deploy.jsonc`);
  process.exit(1);
}
console.log("Done. Migration 0008 applied and stock sized to the last week's sales.\nDeploy the PIN-0031 code next: npm run deploy");
