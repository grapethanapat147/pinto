# Daily brief: an Action Center computed from the shop's own data

**Status:** decided 2026-11-03. เกรพ accepted all eight recommendations.

| | decision |
| --- | --- |
| Q1 | The four seeded actions are deleted; `actions` deprecated in place |
| Q2 | Six rules: stock, late packing, review, unread chats; ad spend and missing cost owner-only |
| Q3 | Days left computed from 7-day sales; seed `on_hand` scaled; production by a guarded script |
| Q4 | Pack window is a shop setting, default 24 h, labelled as the shop's rule |
| Q5 | Only factual amounts on cards; the headline impact total goes |
| Q6 | One secondary action, "ซ่อนถึงพรุ่งนี้", in `action_snoozes`; the primary goes where the work is |
| Q7 | Three-step, data-derived checklist for owners; PIN-0028 joins phase 1 |
| Q8 | Setting a first cost offers once to fill past lines that had none |

Phase 1 of the roadmap เกรพ approved on 2026-11-03, after a scan of Shopify Sidekick, Amazon
Seller Assistant, TikTok Shop's AI homepage, Triple Whale, Shopee/Lazada and ZORT:

| phase | what | needs |
| --- | --- | --- |
| **1** | **Daily brief** (this spec) + new-seller checklist + PIN-0028 cost editing | nothing external |
| 2 | Ask the shop in Thai — an LLM answering only from computed figures, citing them | an LLM, a cost budget |
| 3 | Fees and shipping in profit; drafted chat replies (LINE first); approve-before-act with an audit log | marketplace credentials |

The pattern every platform converged on: stop waiting to be read, **say what needs doing
today, why, and what it costs to skip it** — TikTok's To-Do agent splits fixed from floating
deadlines and states the risk of missing each; Sidekick's Winter '26 release moved from
answering to suggesting. Their limit is that each sees only its own platform. Pinto sees all three.

## What the Action Center actually is today

Four rows typed into `app/fixtures/actions.ts`. **None is computed**, and two describe data
Pinto does not have at all:

| card | can it be computed? |
| --- | --- |
| TikTok campaign overspending, "เสี่ยงเสีย ฿3,240" | partly — `ad_spend_daily` is per channel per day, not per campaign |
| "พบ 8 ออเดอร์ยกเลิกผิดปกติ" | **no** — there is no cancellation or customer-history data |
| Ceramic vase restock, "โอกาส ฿12,400" | yes, from sales and stock |
| "น้ำหนักเรียกเก็บไม่ตรง 4 พัสดุ" | **no** — there is no shipping or carrier data |

The drawer also shows **"ความมั่นใจของคำแนะนำ 92%"** — a literal. Nothing computes a
confidence, and a rule has none to compute. It is the same kind of claim PIN-0027 removed from
the Money view.

The sidebar badge (4) and the Action Center headline total (the sum of the four impacts) are
derived from these rows, so they are as fictional as the rows.

### The blocker found while checking this spec

`inventory_levels.days_left` is **stored**, and `on_hand` is still the small shop the fixtures
described — while PIN-0027 gave the shop ~280 orders a day:

| SKU | on hand | stored days left | units sold / day (last 7 days) | computed days left |
| --- | ---: | ---: | ---: | ---: |
| ถาดไม้โค้ง Natural | 112 | 21 | 129 | **0.9** |
| แจกันเซรามิกสีครีม | 42 | 3 | 90 | **0.5** |
| ผ้าปูโต๊ะ Linen Sand | 19 | 4 | 73 | **0.3** |
| ชุดแก้ว Amber 4 ใบ | 86 | 14 | 44 | **1.9** |

Computing "runs out in N days" honestly turns every product red. Same shape as PIN-0027's
blocker: one table describes a different shop from the others. See Q3.

## Design

**A card is a rule applied to the data, never a row someone typed.** Each rule names its
subject (an order set, a product, a channel), so a card has a stable key — `stock:ML-CV-018`
— and disappears by itself when the condition stops being true.

Every card answers the same three questions, which is what TikTok's To-Do agent gets right:

1. **ทำไมถึงขึ้นมา** — the fact that triggered it, with its numbers.
2. **ถ้าไม่ทำ** — the consequence, stated as a fact, not a forecast (Q5).
3. **ทำอะไรต่อ** — one button that goes to the place to do it.

Urgency is a property of the rule, not a guess: a card with a deadline today sorts above one
that can wait, and the card says which it is.

The drawer replaces the 92% with **"ข้อมูลที่ใช้"**: which rows the rule read and up to when
(the same last-sync anchor as PIN-0027).

## Open questions

### Q1 — What happens to the four seeded actions?
**Recommend: delete them.** Two describe data that does not exist; keeping them beside
computed cards repeats the PIN-0027 problem of fiction next to fact. The `actions` table is
deprecated in place, like `channel_metrics`.

### Q2 — Which rules ship first?
**Recommend six**, all computable from data already in the database:

| rule | triggers when | who sees it |
| --- | --- | --- |
| สต๊อกใกล้หมด | days left (from 7-day sales) under a threshold | everyone |
| ออเดอร์รอแพ็กนาน | `รอแพ็ก` older than the shop's pack window (Q4) | everyone |
| ออเดอร์ต้องตรวจสอบ | any order in `ตรวจสอบ` | everyone |
| แชตค้างตอบ | unread conversations | everyone |
| ค่าโฆษณาต่อยอดขายสูงผิดปกติ | a channel's ad spend ÷ sales yesterday is well above its 7-day level | owner only |
| ต้นทุนสินค้ายังไม่ครบ | any product without a cost | owner only |

The last two are owner-only for the same reason as PIN-0013: they are money, not operations.

### Q3 — How is stock made consistent with sales?
**Recommend: compute days left, and scale `on_hand` in the seed** so each product keeps the
story the fixtures told (vase ~3 days, lamp out, linen ~4, glasses ~14, tray ~21) at the new
sales rate. `days_left` becomes derived and is deprecated in place.

Production needs the same change to existing `inventory_levels` rows. Unlike PIN-0029 this
**updates** rows rather than adding them, so it gets its own guarded script with a dry run
and a Time Travel bookmark, and runs only with your go-ahead.

### Q4 — What counts as "waiting too long to pack"?
No platform has sent a ship-by deadline yet — that arrives with the adapters. **Recommend a
shop setting defaulting to 24 hours, labelled as Pinto's rule** ("เกิน 24 ชม. ตามที่ร้านตั้งไว้"),
never presented as a platform policy. Replaced by the real deadline when an adapter supplies one.

### Q5 — Do cards show a baht amount?
The seeded cards say "เสี่ยงเสีย ฿3,240" and "โอกาส ฿12,400" — forecasts nobody computed.
**Recommend: only amounts that are facts.** Orders waiting to pack: their total value. Stock:
the product's sales per day over the last 7 days. Ads: yesterday's spend. Unread chats and
missing costs: no amount. The headline sum of "impacts" goes, because adding a stock figure
to an order figure means nothing.

### Q6 — What do "done" and "later" mean for a computed card?
A computed card cannot be marked done — it is done when the data says so. **Recommend one
action, "ซ่อนถึงพรุ่งนี้"**, stored per card key in a new `action_snoozes` table. The current
"อนุมัติและทำเครื่องหมายว่าเสร็จ" button is replaced by the card's real action ("ไปที่ออเดอร์",
"ดูสต๊อก"). Additive migration — **production must be migrated before the deploy** (the
PIN-0029 lesson).

### Q7 — What is the new-seller checklist?
**Recommend three steps, each derived from data, owner only, at the top of Today:**
1. เชื่อมช่องทางขายอย่างน้อย 1 ช่องทาง — a channel has synced.
2. ใส่ต้นทุนครบทุกสินค้า — cost coverage is 100%.
3. ดูกำไรจริง — unlocked by 1 and 2; links to Money.

It hides itself when 1 and 2 are done, or when dismissed. Step 2 needs somewhere to enter cost,
which is PIN-0028 — so PIN-0028 moves into Phase 1.

### Q8 — PIN-0028's open question: fill missing cost on past orders?
Costing a product today leaves its past lines uncosted, so "ต้นทุนครบ" stays partial for a
month and step 2 never ticks. **Recommend (ก): when a cost is first set, offer once to fill it
into past lines that had none.** Filling a gap is not rewriting history; changing an existing
cost still never touches past lines.

## Tickets, if the recommendations hold

1. **PIN-0031** — Computed Action Center: the rules, `action_snoozes`, the drawer's
   "ข้อมูลที่ใช้", badge and headline from computed cards, seed stock scaled (Q1–Q6).
2. **PIN-0028** — Cost editing on Stock, with the one-time fill of missing past costs (Q8).
3. **PIN-0032** — New-seller checklist (Q7). Needs PIN-0028.

Then the production step for 0031: migrate, scale stock (guarded), deploy.

## How we will know it worked
- Cards acted on (button clicked) ÷ cards shown, per week.
- Days per week the owner opens Today.
- Cost coverage reaching 100% within the first week after signup (the checklist's job).

## What would make me wrong
- **If sellers live in the platforms' mobile apps**, a dashboard brief is the wrong surface: the
  same cards should go out as a LINE message each morning. That is a delivery change, not a
  rules change, so building the rules first is safe either way.
- If the rules fire so often that the list is always long, that is a threshold problem
  — tune before adding more rules.
