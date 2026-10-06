/**
 * The SQL that brings a database seeded before PIN-0026 up to what PIN-0027 reads (PIN-0029).
 *
 * The deployed database was seeded on 12 Sep with six hand-made orders, no order lines, no ad
 * spend and no product costs — and it holds a granted LINE account, which is why เกรพ chose
 * an additive backfill over reseeding: `scripts/seed.ts` would DELETE that account.
 *
 * **Additive only.** Nothing here deletes a row or changes one that has a value:
 * - product costs are filled only where `unit_cost_satang IS NULL`;
 * - the hand-made orders get their lines; their own rows are untouched;
 * - generated orders, their lines and daily ad spend are inserted.
 *
 * **Anchored to the database's own last sync, not to now.** Every reporting window ends at
 * `max(channel_health.last_synced_at)`, so history generated up to today would sit after the
 * anchor and never be counted. Generated against the anchor, the deployed demo shows the day
 * its data is from — "ข้อมูลถึง 12 ก.ย." — which is what PIN-0027 designed for.
 *
 * Rows are matched by natural keys (shop + external id, shop + SKU, shop + channel code),
 * never by assumed integer ids, so it does not matter what ids the target database used.
 *
 * Not idempotent by itself: `scripts/remote-backfill.mjs` reads the target first and refuses
 * a database that already has lines or ad spend. Keep that check — running this twice would
 * fail on the unique external ids partway through, and a second set of hand-made lines
 * would double their cost.
 *
 * Usage: node scripts/backfill-history.ts --shop 1 --anchor <ISO> --reserved <n>
 */
import { orderLines, productCosts } from "../app/fixtures/order-lines.ts";
import { pricedHistory } from "./generate-history.ts";

/** Below D1's 100 KB per-statement limit with room to spare, Thai names included. */
const ROWS_PER_STATEMENT = 300;

const quote = (value: string | number | null): string => {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Refusing to write non-finite number ${value}`);
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
};

function valuesStatement(
  columns: string[],
  rows: (string | number | null)[][],
  insert: (cte: string) => string
): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const values = rows
      .slice(i, i + ROWS_PER_STATEMENT)
      .map((row) => `(${row.map(quote).join(", ")})`)
      .join(",\n  ");
    out.push(`WITH v(${columns.join(", ")}) AS (VALUES\n  ${values}\n)\n${insert("v")};`);
  }
  return out;
}

export function backfillSql({
  shopId,
  anchor,
  reservedToday,
}: {
  shopId: number;
  /** The target's `max(channel_health.last_synced_at)`. */
  anchor: Date;
  /** Orders the target already has on the anchor's Bangkok day — the hand-made ones. */
  reservedToday: number;
}): { sql: string; summary: { orders: number; lines: number; adDays: number; newest: string; oldest: string } } {
  if (!Number.isInteger(shopId) || shopId < 1) throw new Error(`Invalid shop id ${shopId}`);
  const shop = String(shopId);
  const out: string[] = [];

  // 1. Costs, filling gaps only. A cost someone has already entered is never overwritten.
  for (const [sku, { cost }] of Object.entries(productCosts)) {
    if (cost === null) continue;
    out.push(
      `UPDATE products SET unit_cost_satang = ${Math.round(cost * 100)} ` +
        `WHERE shop_id = ${shop} AND sku = ${quote(sku)} AND unit_cost_satang IS NULL;`
    );
  }

  // 2. Lines for the hand-made orders, with the cost snapshot the seed gives them.
  const handMade = Object.entries(orderLines).flatMap(([externalId, lines]) =>
    lines.map((line) => {
      const { price, cost } = productCosts[line.sku];
      return [externalId, line.sku, line.quantity, Math.round(price * 100), cost === null ? null : Math.round(cost * 100)];
    })
  );
  const insertLines = (cte: string) =>
    "INSERT INTO order_lines (shop_id, order_id, product_id, quantity, unit_price_satang, unit_cost_satang)\n" +
    `SELECT ${shop}, o.id, p.id, ${cte}.qty, ${cte}.price, ${cte}.cost FROM ${cte}\n` +
    `JOIN orders o ON o.shop_id = ${shop} AND o.external_id = ${cte}.ext\n` +
    `JOIN products p ON p.shop_id = ${shop} AND p.sku = ${cte}.sku`;
  out.push(...valuesStatement(["ext", "sku", "qty", "price", "cost"], handMade, insertLines));

  // 3. Generated history, up to the anchor.
  const { orders, adDays } = pricedHistory({ anchor, reservedToday, prices: productCosts });

  out.push(
    ...valuesStatement(
      ["ext", "ch", "customer", "total", "status", "placed_at"],
      orders.map((o) => [o.externalId, o.channel, o.customer, o.totalSatang, o.status, o.placedAt]),
      (cte) =>
        "INSERT INTO orders (shop_id, channel_id, external_id, customer_name, total_satang, status, placed_at)\n" +
        `SELECT ${shop}, c.id, ${cte}.ext, ${cte}.customer, ${cte}.total, ${cte}.status, ${cte}.placed_at FROM ${cte}\n` +
        `JOIN channels c ON c.shop_id = ${shop} AND c.code = ${cte}.ch`
    )
  );

  const generatedLines = orders.flatMap((o) =>
    o.lines.map((line) => [o.externalId, line.sku, line.quantity, line.unitPriceSatang, line.unitCostSatang])
  );
  out.push(...valuesStatement(["ext", "sku", "qty", "price", "cost"], generatedLines, insertLines));

  out.push(
    ...valuesStatement(
      ["ch", "day", "spend"],
      adDays.map((ad) => [ad.channel, ad.day, ad.spendSatang]),
      (cte) =>
        "INSERT INTO ad_spend_daily (shop_id, channel_id, day, spend_satang)\n" +
        `SELECT ${shop}, c.id, ${cte}.day, ${cte}.spend FROM ${cte}\n` +
        `JOIN channels c ON c.shop_id = ${shop} AND c.code = ${cte}.ch`
    )
  );

  const placed = orders.map((o) => o.placedAt).sort();
  return {
    sql: out.join("\n\n") + "\n",
    summary: {
      orders: orders.length,
      lines: generatedLines.length + handMade.length,
      adDays: adDays.length,
      oldest: placed[0],
      newest: placed[placed.length - 1],
    },
  };
}

// CLI: print the SQL. Only when run directly, so tests can import `backfillSql`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name: string) => {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing --${name}`);
    return process.argv[index + 1];
  };
  const anchor = new Date(arg("anchor"));
  if (Number.isNaN(anchor.getTime())) throw new Error(`--anchor is not a date: ${arg("anchor")}`);
  const { sql } = backfillSql({ shopId: Number(arg("shop")), anchor, reservedToday: Number(arg("reserved")) });
  process.stdout.write(sql);
}
