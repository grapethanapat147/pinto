/**
 * Applies the Drizzle migrations and the seed to the LOCAL miniflare D1.
 *
 * Local development only. Production seeding is deliberately out of scope — the platform
 * applies migrations on deploy (unverified, see spec Q4) and nothing here should be
 * pointed at a real database. That is why every npm script wrapping this is named
 * `db:local:*`.
 *
 * Usage: node scripts/local-db.mjs [migrate|seed|reset]
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const D1_DIR = join(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

function localDatabase() {
  if (!existsSync(D1_DIR)) {
    throw new Error(
      `No local D1 found at ${D1_DIR}.\n` +
        "Start the dev server once (npm run dev) so miniflare creates it, then retry."
    );
  }
  // metadata.sqlite is miniflare's own bookkeeping, not the bound database
  const files = readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one D1 database in ${D1_DIR}, found ${files.length}: ${files.join(", ")}.\n` +
        "Refusing to guess which one is bound as DB."
    );
  }
  return join(D1_DIR, files[0]);
}

function sqlite(dbPath, sql) {
  execFileSync("sqlite3", [dbPath], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
}

function migrate(dbPath) {
  const dir = join(root, "drizzle");
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  if (!journal.entries.length) throw new Error("No migrations generated yet — run npm run db:generate.");
  for (const entry of journal.entries) {
    const file = join(dir, `${entry.tag}.sql`);
    console.log(`  applying ${entry.tag}`);
    // drizzle separates statements with this marker; sqlite3 treats it as a comment
    sqlite(dbPath, readFileSync(file, "utf8"));
  }
}

function seed(dbPath) {
  const sql = execFileSync("node", [join(root, "scripts/seed.ts")], { encoding: "utf8" });
  sqlite(dbPath, sql);
}

const command = process.argv[2] ?? "reset";
const dbPath = localDatabase();
console.log(`local D1: ${dbPath.replace(root + "/", "")}`);

if (command === "migrate" || command === "reset") migrate(dbPath);
if (command === "seed" || command === "reset") seed(dbPath);
if (!["migrate", "seed", "reset"].includes(command)) {
  throw new Error(`Unknown command ${JSON.stringify(command)} — expected migrate, seed or reset.`);
}

sqlite(dbPath, "PRAGMA foreign_key_check;");
console.log("done — foreign keys clean");
