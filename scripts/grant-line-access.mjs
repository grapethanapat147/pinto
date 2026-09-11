/**
 * Grants a LINE account access to a shop, in the LOCAL miniflare D1 (PIN-0014).
 *
 * The callback refuses a LINE identity that has no user row, because creating one there
 * would attach any LINE account to an existing shop's orders, customers and payouts. This
 * is the deliberate bootstrap: it needs filesystem access to the project, which is the
 * whole point of not doing it over HTTP.
 *
 * Usage: npm run auth:grant-line            (prompts for the id)
 *        npm run auth:grant-line -- Uxxx owner
 *
 * The LINE user id is shown to the caller on the refusal page after a successful LINE
 * sign-in. It is an identifier, not a secret, and nothing secret is written here.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { prompt } from "./prompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const D1_DIR = join(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

function localDatabase() {
  if (!existsSync(D1_DIR)) {
    throw new Error(
      `No local D1 found at ${D1_DIR}.\n` +
        "Start the dev server once (npm run dev) so miniflare creates it, then retry."
    );
  }
  const files = readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one D1 database in ${D1_DIR}, found ${files.length}: ${files.join(", ")}.`
    );
  }
  return join(D1_DIR, files[0]);
}

const query = (db, sql) =>
  execFileSync("sqlite3", [db, sql], { encoding: "utf8" }).trim();

const [argId, role = "owner", shopArg] = process.argv.slice(2);

// Asking beats a documented placeholder. `npm run auth:grant-line -- <id>` sent a real
// person's shell a redirection error, because `<` is redirection — so there is no
// placeholder to fumble any more.
const lineUserId =
  argId ??
  (await prompt("LINE user id (shown on the refusal page after signing in with LINE): "));

if (!lineUserId) {
  console.error("No LINE user id given. Sign in with LINE once; the refusal page shows it.");
  process.exit(1);
}
if (role !== "owner" && role !== "staff") {
  console.error(`Role must be "owner" or "staff", got ${JSON.stringify(role)}.`);
  process.exit(1);
}
// LINE user ids are `U` followed by 32 hex characters. Checking it here keeps a typo from
// becoming a row that silently never matches a real sign-in.
if (!/^U[0-9a-f]{32}$/.test(lineUserId)) {
  console.error(
    `${JSON.stringify(lineUserId)} does not look like a LINE user id (U + 32 hex characters).\n` +
      "Copy it from the refusal page shown after signing in with LINE."
  );
  process.exit(1);
}

const db = localDatabase();
const escape = (value) => `'${String(value).replace(/'/g, "''")}'`;

const shopId = shopArg ?? query(db, "SELECT id FROM shops ORDER BY id LIMIT 1;");
if (!shopId) {
  console.error("No shop rows found. Run `npm run db:local:seed` first.");
  process.exit(1);
}

const existing = query(
  db,
  `SELECT id || '|' || role FROM users WHERE provider = 'line' AND provider_user_id = ${escape(lineUserId)};`
);

if (existing) {
  const [id, currentRole] = existing.split("|");
  query(db, `UPDATE users SET role = ${escape(role)}, shop_id = ${shopId} WHERE id = ${id};`);
  console.log(`Updated user ${id}: role ${currentRole} -> ${role}, shop ${shopId}.`);
} else {
  query(
    db,
    `INSERT INTO users (shop_id, provider, provider_user_id, display_name, role, created_at)
     VALUES (${shopId}, 'line', ${escape(lineUserId)}, 'ผู้ใช้ LINE', ${escape(role)}, ${escape(new Date().toISOString())});`
  );
  const id = query(db, `SELECT id FROM users WHERE provider = 'line' AND provider_user_id = ${escape(lineUserId)};`);
  console.log(`Created user ${id} as ${role} on shop ${shopId}.`);
}

console.log("The display name and picture are replaced with LINE's own on the next sign-in.");
