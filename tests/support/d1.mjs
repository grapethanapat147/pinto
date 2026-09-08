/**
 * A D1Database over Node 24's built-in `node:sqlite`, for tests.
 *
 * Miniflare would give real D1 semantics but boots a workerd process — too slow and it
 * did not terminate cleanly in this repo. Drizzle's d1 driver only uses prepare / bind /
 * all / run / first / raw / batch, so an in-process shim covers it and keeps `npm test`
 * instant.
 *
 * Caveat: `bind()` stores params on the statement, so a statement reused with different
 * bindings would clash. Drizzle calls `prepare()` per query, so this does not arise.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function asD1(database) {
  const prepare = (sql) => {
    let params = [];
    const statement = {
      bind(...bound) {
        params = bound;
        return statement;
      },
      async all() {
        return { success: true, results: database.prepare(sql).all(...params), meta: {} };
      },
      async run() {
        const info = database.prepare(sql).run(...params);
        return {
          success: true,
          results: [],
          meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
        };
      },
      async first(column) {
        const row = database.prepare(sql).get(...params) ?? null;
        return column && row ? row[column] : row;
      },
      async raw() {
        return database.prepare(sql).all(...params).map((row) => Object.values(row));
      },
    };
    return statement;
  };

  return {
    prepare,
    async batch(statements) {
      const out = [];
      for (const statement of statements) out.push(await statement.all());
      return out;
    },
    async exec(sql) {
      database.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
}

/** Fresh in-memory database with the real migration and the real seed applied. */
export function createTestD1() {
  const database = new DatabaseSync(":memory:");

  const drizzleDir = join(root, "drizzle");
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) {
    database.exec(readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf8"));
  }

  // the same seed the local database uses, so tests exercise the real fixture mapping
  database.exec(execFileSync("node", [join(root, "scripts/seed.ts")], { encoding: "utf8" }));

  return asD1(database);
}
