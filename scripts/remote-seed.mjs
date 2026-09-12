/**
 * Seeds the deployed demo database (PIN-0021). See `.codex/specs/deploy-cloudflare.md`.
 *
 * **`scripts/seed.ts` is destructive.** It opens with `DELETE FROM` across 22 tables,
 * including `users` and `sessions`, and then inserts the demo shop. That is right for a
 * local reset and it is right for a first run into an empty database. Run a second time
 * against a live one, it destroys every account that was granted access — including any
 * LINE identity added with `auth:grant-line` — and signs everyone out.
 *
 * So this refuses by default. The guard is a read of the target database, not a flag or a
 * comment, and `--force` requires typing the database name to get past it.
 *
 * Usage: npm run db:remote:seed [-- --force]
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

if (!target?.database_name) {
  console.error("wrangler.deploy.jsonc has no DB binding to seed.");
  process.exit(1);
}

const wrangler = (args) =>
  execFileSync("npx", ["wrangler", ...args], { cwd: root, encoding: "utf8" });

/** -> row count, or null when the table does not exist (migrations not applied). */
function countShops() {
  try {
    const out = wrangler([
      "d1", "execute", target.database_name, "--remote", "-c", config,
      "--command", "SELECT COUNT(*) AS n FROM shops", "--json",
    ]);
    return Number(JSON.parse(out.slice(out.indexOf("[")))[0].results[0].n);
  } catch {
    return null;
  }
}

const force = process.argv.includes("--force");
const existing = countShops();

if (existing === null) {
  console.error(
    `Could not read shops from "${target.database_name}". Either the migrations have not been\n` +
      "applied (`npx wrangler d1 migrations apply " + target.database_name +
      " --remote -c wrangler.deploy.jsonc`)\nor the database is unreachable. Nothing was written."
  );
  process.exit(1);
}

if (existing > 0 && !force) {
  console.error(
    `"${target.database_name}" already has ${existing} shop row(s), so it is not empty.\n\n` +
      "The seed starts by DELETEing 22 tables, including users and sessions. Running it here\n" +
      "would destroy every granted account and sign everyone out.\n\n" +
      "If that is genuinely what you want: npm run db:remote:seed -- --force"
  );
  process.exit(1);
}

if (existing > 0) {
  console.log(`"${target.database_name}" has ${existing} shop row(s).`);
  console.log("Seeding DELETEs 22 tables first — every user, session and granted LINE account goes.");
  const typed = await prompt(`Type the database name to confirm (${target.database_name}): `);
  if (typed !== target.database_name) {
    console.error("Did not match. Nothing was written.");
    process.exit(1);
  }
}

console.log(`Generating the seed and applying it to "${target.database_name}"…`);
const sql = execFileSync("node", [join(root, "scripts/seed.ts")], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const sqlPath = join(tmpdir(), `pinto-seed-${process.pid}.sql`);
writeFileSync(sqlPath, sql);

try {
  const out = wrangler([
    "d1", "execute", target.database_name, "--remote", "-c", config, "--file", sqlPath, "--yes",
  ]);
  console.log(out.split("\n").filter((line) => line.trim()).slice(-4).join("\n"));
} finally {
  unlinkSync(sqlPath);
}

const after = countShops();
console.log(`\nDone. "${target.database_name}" now has ${after} shop row(s).`);
console.log("The demo sign-in should work on the deployed URL.");
