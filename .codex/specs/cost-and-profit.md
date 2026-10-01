# Cost, and making profit a real number

**Status:** decided 2026-10-01. เกรพ accepted all six recommendations.

| | decision |
| --- | --- |
| Q1 | One current cost per SKU, snapshotted onto each order line |
| Q2 | `order_lines` seeded now, consistent with existing order totals; adapters fill them later |
| Q3 | Profit computed; the three stored profit columns deprecated in place |
| Q4 | Inline cost editing on Stock first, CSV import later |
| Q5 | Cost is owner-only, enforced on the server |
| Q6 | Ship the minimal version as three tickets: PIN-0026, PIN-0027, PIN-0028 |

Pinto's reason to exist is in its own copy: *"เชื่อมต้นทุนให้ครบ เพื่อเห็นกำไรที่แม่นยำขึ้น"*.
Today that sentence sits above a button that says the feature is not available, and the
profit it promises is a seeded constant.

**None of this needs marketplace credentials.** Cost is data the merchant types in, not data
a platform returns. This is the one large piece of the product that can be built now.

## What the database actually holds

There is **no cost anywhere in the schema** — no table, and no cost column on `products`,
which stores only `sku`, `name` and `category`.

Profit is a **stored number in three places**, none of them derived:

| table | column | shown as |
| --- | --- | --- |
| `channel_metrics` | `profit_satang` | the per-channel table on Today |
| `waterfall_steps` | `amount_satang` where `kind = 'profit'` | the Money view's waterfall |
| `product_opportunities` | `profit_satang` | the Growth view's product list |

`.codex/specs/schema-v1.md` F2 is titled *"Some displayed values are already derivable — and
already drift"*, and this is the largest instance of it left. ฿48,720 กำไรวันนี้ is a figure somebody typed into a fixture.

### The structural blocker

**`orders` has no line items.** It stores `total_satang`, `customer_name`, `status` and the
channel — and nothing about *what was sold*. There is no `order_lines` table.

So even with a cost per product, cost of goods sold per order cannot be computed. **Order
lines are a prerequisite for cost, not a nice-to-have**, and they are a bigger change than
cost itself. Any plan that skips them produces a profit number that is still a guess.

### A related lie, found while checking this spec
The Stock view's heading says **"สินค้า 186 รายการ"**. The database holds **5** products. That
figure — and its siblings "284 ออเดอร์วันนี้", "12 ข้อความรอตอบ" and "ลูกค้า 3,842 คน" — are
literals in `viewTitles` in `app/fixtures/navigation.ts`, not counts. They are outside this
spec's scope but they are the same class of problem, and cheap to fix: each is a `COUNT(*)`.

## Design

### Cost lives in two places, on purpose
- **`products.unit_cost_satang`** — what a unit costs *now*. What the merchant maintains.
- **`order_lines.unit_cost_satang`** — what it cost *when that order was placed*, copied in
  at the time the line is recorded.

The snapshot is the part that matters. Without it, raising a supplier price next month
silently rewrites last month's profit, and a merchant who checks the same number twice gets
two answers. With it, history is frozen and "why did March change?" never happens.

### Fees and shipping are not cost of goods
The waterfall already models them separately — its `kind` enum is
`sales | cost | ads | fees | profit`. Keeping that split:

| bucket | where it comes from |
| --- | --- |
| COGS | `order_lines.unit_cost_satang × quantity` |
| platform fees | per order, **from the marketplace**, so zero until PIN-0025's work lands |
| shipping | per order |
| ads | `campaigns.spend_satang`, already stored per campaign (seeded, like everything else) |

Profit = sales − COGS − fees − shipping − ads. Three of the five are available now.

### Partial coverage must be visible, not silent
A merchant will not price every SKU on day one. If a third of the catalogue has a cost and
Pinto prints a single confident profit figure, it is lying — the same failure PIN-0001 was created
to end.

So **every profit figure carries its coverage**: the share of revenue in that period whose
items have a cost. Below 100% the number is labelled as covering only part of the revenue, and
the Today card says how much is missing and links to the products that are missing it. That
turns an inaccuracy into a to-do list, which is also the thing that gets the data filled in.

## Open questions

### Q1 — Cost per product, or cost per purchase lot?
- **(a) One current cost per SKU.** The merchant types one number. Simple to enter, simple to
  explain, and with the order-line snapshot above, history stays correct.
- **(b) Lots with FIFO or weighted average.** Accurate when purchase prices move a lot, and
  the right answer for a business with real inventory accounting. It needs a purchase-order
  model, receiving, and a costing method — several tickets, not one.

**Recommendation: (a).** A Thai shop owner comparing three marketplaces needs "am I making
money on this" answered today, not a perpetual inventory system. (b) stays reachable because
the snapshot column means moving to it later changes how `products.unit_cost_satang` is
*computed*, not how orders store cost.

### Q2 — Where do order lines come from?
This is the real scope question.

- **(a) Seeded now, marketplace later.** `order_lines` exists, the seed fills it, and the
  adapters populate it when they land. Profit becomes real for seeded data immediately.
- **(b) Wait for the marketplace adapters.** No invented data, but cost stays unusable and
  this whole spec waits on credentials — which is what เกรพ asked to avoid.
- **(c) Let the merchant enter lines by hand.** Realistic only for a handful of orders.

**Recommendation: (a)**, and the fixtures must be *consistent* — line totals summing to each
order's existing `total_satang` rather than new numbers invented beside it.

### Q3 — What happens to the three stored profit columns?
Once profit is computed, `channel_metrics.profit_satang`, the waterfall's profit row and
`product_opportunities.profit_satang` are duplicates that will drift.

**Recommendation:** compute them and stop storing them, the same move PIN-0016 made for
`inventory_levels.sync_state`. Note that migrations here are additive only, so the columns
are deprecated in place rather than dropped.

### Q4 — How does a merchant enter cost?
- **(a) Inline on the Stock view**, a field per product row.
- **(b) A dedicated cost screen**, which is what the existing "เพิ่มข้อมูลต้นทุน" button
  promises.
- **(c) CSV import**, the only sane answer for a catalogue of a hundred or more SKUs.

**Recommendation: (a) then (c).** Inline editing makes the common correction one click, and
import makes the first load possible. (b) is a screen that would mostly duplicate the Stock
view.

### Q5 — Does cost belong to staff?
`staff` already cannot see Money. Supplier prices are commercially sensitive in the same way.

**Recommendation: owner only**, enforced server-side like PIN-0013, and the Stock view shows
staff everything except the cost column.

### Q6 — What is the smallest version worth shipping?
A full costing system is several tickets. The smallest thing that makes the headline honest:

1. `order_lines` + `products.unit_cost_satang`, seeded consistently.
2. Profit computed for Today and Money from those, with coverage shown.
3. Inline cost editing on Stock, owner only.

Fees, shipping, lots, CSV import and the Growth view's per-product profit come after.

## What would make me wrong
If เกรพ's actual customers already keep cost in an accounting system and want Pinto to read it
rather than own it, the entry work in Q4 is wasted and the answer is an import adapter. That
is worth asking a real shop owner before building the editing UI.
