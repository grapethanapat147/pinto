# Schema v1 — proposal for review

Draft for PIN-0003. **Not implemented.** Companion to
`.codex/specs/persistence-foundation.md`, whose D5 (shop scoping) and Q4 (additive-only
migrations) apply throughout.

## What the audit turned up first

Three findings that change the shape of the ticket, all verified 2026-09-08.

### F1. Most of the money on screen is not in the fixtures

| Location | ฿ values |
| --- | --- |
| Hardcoded in `app/components/*.tsx` | **41** |
| In `app/fixtures/*.ts` | 23 |

Moving the six fixture collections into D1 therefore leaves roughly two thirds of the
dashboard's numbers frozen in JSX — and, worse, silently inconsistent with the database:

- `TodayView` shows `ยอดขายรวม ฿126,840` and `ออเดอร์ทั้งหมด 284` as literals. The orders
  table would hold 6 rows. Insert an order and neither number moves.
- The channel table's `TikTok Shop · ฿68,420 · 142` is a literal, while `payouts` holds a
  separate `142 ออเดอร์ / ฿38,740` for the same channel.
- `viewTitles.orders.kicker` says `284 ออเดอร์วันนี้` — a literal in a fixture that no
  query will ever agree with.

### F2. Some displayed values are already derivable — and already drift

`ActionsView`'s hero total `฿22,990` is exactly `3,240 + 6,890 + 12,400 + 460`, the sum
of the four action impacts. It is hardcoded, so PIN-0001's demo already shows the bug:
resolve an action and the heading correctly drops to `มี 3 เรื่อง` while the total stubbornly
stays `฿22,990`.

Campaign `roas` is likewise exactly `revenue / spend` for all four rows (3.14, 4.65,
3.82, 2.92 — verified). Inventory `status` is derivable from `on_hand` and `days_left`
(`หมดสต๊อก` at 0, `ใกล้หมด` under a week).

Storing these as columns would bake the drift in permanently.

### F3. Every number and timestamp is a display string

`"฿1,890"`, `"10:36"`, `"26 ส.ค."`, `"142 ออเดอร์"`, and a message stamped `"เมื่อวาน"`.
Nothing can be summed, sorted or compared as stored.

## Proposed tables

Money is `INTEGER` **satang** (฿1,890 → `189000`), never text and never float.
Timestamps are ISO-8601 `TEXT` (SQLite convention, matches the `examples/d1` reference).
Every table carries `shop_id` per D5. Derived values are **not** stored.

```
shops              id · name · created_at
channels           id · shop_id · code · display_name · kind          -- kind: marketplace | ads | chat
products           id · shop_id · sku · name · category
inventory_levels   id · shop_id · product_id → products
                   on_hand · reserved · days_left · sync_state
orders             id · shop_id · channel_id → channels
                   external_id · customer_name · total_satang · status · placed_at
conversations      id · shop_id · channel_id → channels · order_id → orders (nullable)
                   customer_name · topic · unread_count · last_message_at
messages           id · shop_id · conversation_id → conversations
                   sender · body · sent_at                            -- sender: customer | shop
actions            id · shop_id · channel_label · tone · label · title · detail
                   impact_kind · impact_satang · insight · recommendation
                   detected_at · resolved_at                          -- resolved_at NULL = open
campaigns          id · shop_id · channel_id → channels
                   name · spend_satang · revenue_satang · health
payouts            id · shop_id · channel_id → channels
                   expected_on · order_count · amount_satang · status
```

Deliberately **absent** as columns, computed instead:

| Value | Derivation |
| --- | --- |
| campaign `roas` | `revenue_satang / spend_satang` |
| inventory `status` | `on_hand = 0` → หมดสต๊อก; `days_left ≤ 7` → ใกล้หมด; else พร้อมขาย |
| action-hero total | `SUM(impact_satang) WHERE resolved_at IS NULL` |
| active action count | `COUNT(*) WHERE resolved_at IS NULL` |

Notes on specific choices:

- **`products` split from `inventory_levels`.** The fixture merges catalogue data
  (sku/name/category) with stock counts. Splitting them is what lets stock later be
  per-channel, which is the whole premise of the product.
- **`channels` as a table.** The fixtures name the same channel four different ways —
  `TikTok`, `TikTok Shop`, `TikTok Ads`, `Shopee + TikTok`. Milestone 3's channel adapter
  needs one canonical list; introducing it now costs nothing.
- **`actions.channel_label` stays free text.** `Shopee + TikTok` is genuinely two
  channels; modelling that properly is a join table this milestone does not need.
- **`days_left` is stored and denormalised.** It should be `on_hand ÷ sales velocity`,
  and there is no velocity data to compute it from yet.
- **`external_id` on orders**, keeping `TT-10842` as marketplace-facing while the primary
  key stays internal.

## Decisions — RESOLVED 2026-09-08 (เกรพ approved all three recommendations)

### Q1 — What happens to the 41 hardcoded numbers?

- **(a) Leave them.** Smallest ticket; the dashboard stays visibly incoherent with its
  own database, and every metric tile is a lie of a different kind than the one PIN-0001
  just fixed.
- **(b) Derive them from D1** — sales totals, order counts, channel breakdowns, the
  waterfall. Honest, and the only version where the product's premise works. Considerably
  more than "schema + migration": it means the metric tiles become queries.
- **(c) Move them into the seed as their own tables** (e.g. `daily_metrics`), so they are
  data rather than literals but nothing has to be computed yet. Middle path.

**Recommendation: (c) now, (b) later.** It keeps PIN-0003 to a schema ticket, removes the
literals, and leaves the aggregation work to its own ticket where it can be tested.

### Q2 — Real timestamps or frozen display strings?

Storing ISO timestamps means the seed can anchor to "now", so the demo always looks like
today rather than permanently 25 August 2569. But the visible times would then differ
from today's screens, which contradicts the spec's "renders exactly as it does today"
criterion.

**Recommendation: real timestamps, anchored at seed time**, and amend that acceptance
criterion to "identical in layout and content, with times relative to the seed run". A
prototype that says `อัปเดต 10:38 น.` forever ages badly in front of a client.

### Q3 — Is `฿22,990` allowed to change?

Under this schema it becomes a live sum, so resolving an action drops it. That is a bug
fix, but it is also a visible behaviour change the spec currently forbids. Confirm it is
wanted.

---

## Resolved 2026-09-08

- **Q1 → (c).** The 41 literals move into the seed as data now; deriving them from D1 is
  a later ticket. Adds a small presentation layer to the schema, marked as scaffolding.
- **Q2 → real ISO timestamps, anchored at seed time.** The "renders exactly as today"
  criterion in `persistence-foundation.md` is amended accordingly.
- **Q3 → yes, `฿22,990` becomes a live sum** and drops when an action is resolved. The
  spec's "no visible behaviour change" rule takes this one documented exception, because
  the current behaviour is a bug.
