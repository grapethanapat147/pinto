# Spec — Persistence foundation

Milestone 2 from `CLAUDE.md`: *"Add server-side persistence for products, inventory,
orders, conversations, and actions."*

## Why

Pinto is currently a front-end demo. Every record lives in `app/fixtures/*.ts` as a
module-level constant, and every mutation is React state that dies on reload:

| Interaction | Today | Problem |
| --- | --- | --- |
| Resolve an action | `resolvedIds` in `useState` | gone on refresh |
| Send an inbox reply | `sentReplies` in `useState` | gone on refresh; never sent anywhere |
| Every other button | `notify()` toast only | **claims success for work that never happened** |

That last row is the real driver. `CLAUDE.md` says a toast must not be presented as a
successful marketplace action until a real backend confirms it — right now roughly two
dozen buttons violate that. Persistence is the prerequisite for fixing it honestly.

## Scope

In scope: a durable store for the five domains named in the milestone, the read path
that feeds the existing views from it, and the two write paths that already pretend to
work (resolve action, send reply).

Out of scope, explicitly:

- Real TikTok Shop / Shopee / LINE MyShop API calls (that is milestone 3, and it needs
  the channel adapter interface designed first).
- Authentication and roles (milestone 4). See "Shop scoping" below for what this spec
  must nonetheless get right so milestone 4 is not a painful migration.
- Any change to visual design, copy, or layout. After this work the demo must look
  identical to a user until they reload the page and see their change survive.

## Current technical facts (verified 2026-09-08)

- Stack: React 19 + TypeScript on **vinext** (Vite) building for Cloudflare Workers.
- `db/schema.ts` is an intentionally empty stub. `db/index.ts` exposes `getDb()` which
  wraps `drizzle(env.DB)` and throws a descriptive error when the binding is missing.
- `drizzle.config.ts` targets `dialect: "sqlite"`, output `./drizzle`.
  `drizzle/meta/_journal.json` has `"entries": []` — **no migration has ever been generated.**
- `package.json` already has `db:generate` (`drizzle-kit generate`). There is no
  `db:migrate` / `db:seed` script.
- `examples/d1/` contains a complete working reference: a table, and an API route with
  the error handling for the "table does not exist yet" case. Follow its conventions.
- `worker/index.ts` already declares `DB: D1Database` on its `Env`.
- **`.openai/hosting.json` currently has `"d1": null`** — the D1 binding is not
  provisioned. `vite.config.ts` reads that field and only registers `d1_databases`
  when it is truthy, so local dev is off too.
- `app/page.tsx` is `"use client"`, so the entire component tree below it is client-side.
- `npx tsc --noEmit` currently reports 3 pre-existing errors in `db/index.ts` and
  `worker/index.ts` (`cloudflare:workers`, `Fetcher`, `D1Database` all unresolved).
  Cloudflare types are not installed.

## Decisions

### D1. Store: Cloudflare D1 via Drizzle

Use what is already scaffolded. It is the platform's native store, `getDb()` and the
drizzle config exist, and `examples/d1/` is a working reference.

Enabling it requires editing `.openai/hosting.json` to `"d1": "DB"`.
⚠️ `CLAUDE.md` says to preserve that file for the existing Sites deployment — the
`project_id` must not change, and no secret may be added. Only the `d1` field changes.

### D2. Fixtures become the seed, not the source

`app/fixtures/*.ts` keeps its current shape and becomes the input to a seed script. The
demo data on screen after seeding must be byte-identical to today's. This keeps the
diff reviewable: if a screen changes, something is wrong.

Types stay in `app/types.ts` as the shared contract. Drizzle row types must be mapped to
those types at the data-access boundary, not leaked into components.

### D3. Read path: server components, not client fetch

`app/page.tsx` becomes a thin **server** component that reads from D1 and passes data
into a `"use client"` shell (the current `Home` body, moved to
`app/components/AppShell.tsx`). Views keep receiving plain props and stay unaware of
the data source.

Rejected alternative: keeping everything client-side and fetching from API routes on
mount. It adds a loading flash to a dashboard whose whole value is "open it and see
today at a glance", and doubles the work (route + fetch + cache) for a read that the
server can just do.

API routes are still needed for **writes** (D4).

### D4. Writes go through API routes and re-read

`POST /api/actions/:id/resolve` and `POST /api/conversations/:id/messages` persist, then
the client refreshes the affected data. No optimistic UI in this phase — correctness
first, and Inertia-style optimism is not worth it at demo scale.

The toast fires **after** the response confirms success, and shows an error state when
it does not.

### D5. Shop scoping now, auth later

Every table carries a non-null `shop_id` from the first migration, defaulting to the
single seeded demo shop (`Mali Living`). Milestone 4 then adds real authentication and
starts filtering on a column that already exists, rather than requiring a rewrite of
every table and query.

### D6. Buttons that still do nothing must say so

Anything not persisted by this work (print labels, create purchase order, budget
recommendations, download report, …) must stop claiming success. Minimum bar: the toast
text changes from "done" phrasing to explicitly marking it as demo/not-yet-available,
or the control is disabled with a reason. This is a `CLAUDE.md` definition-of-done
requirement, not a nice-to-have.

## Proposed ticket breakdown

| Ticket | Title | Notes |
| --- | --- | --- |
| PIN-0001 | Cloudflare types + D1 binding enabled | Install Cloudflare types, fix the 3 tsc errors, set `"d1": "DB"`, prove `getDb()` reaches a local D1 |
| PIN-0002 | Schema + first migration for all five domains | One migration, `shop_id` everywhere, no UI change |
| PIN-0003 | Seed from fixtures | `db:seed` script; seeded DB reproduces today's screens exactly |
| PIN-0004 | Read path: server/client split + inventory & orders from D1 | The architectural change (D3), proven on two domains |
| PIN-0005 | Read path: actions, conversations, campaigns, payouts | Mechanical once PIN-0004 lands |
| PIN-0006 | Write path: resolve action + send reply persist | Removes the two fake-state interactions |
| PIN-0007 | Honest states for everything still unimplemented | D6, plus loading/empty/error for the now-async views |

PIN-0001 through PIN-0003 change no pixels. PIN-0004 is the risky one and should be
reviewed on its own.

## Acceptance criteria (whole spec)

- [ ] Reloading the page preserves a resolved action and a sent reply.
- [ ] With the DB seeded, every one of the 8 views renders exactly as it does today.
- [ ] No component imports from `app/fixtures/` any more except the seed script.
- [ ] Every table has `shop_id`; every query filters on it.
- [ ] `npx tsc --noEmit` is clean, including `db/` and `worker/`.
- [ ] `npm run build`, `npm run lint`, `npm test` pass.
- [ ] Loading, empty and error states exist for every view that now reads from D1.
- [ ] No control claims success for an operation that did not happen.
- [ ] `.openai/hosting.json` `project_id` is unchanged and holds no secrets.

## Resolved (2026-09-08)

**Q1 — Deploy target: local-only first.** `.openai/hosting.json` flips to `"d1": "DB"`
because local dev reads the same field, but **nothing deploys** until the read path is
proven. Setting the flag does not touch the live site on its own; only a deploy does.
⚠️ Risk to watch: if anyone deploys Pinto for an unrelated reason while the app is
half-migrated, the live site breaks — every view would query a D1 that has no tables.
Deploying stays เกรพ's explicit call.

**Q2 — Persistence is the milestone.** Raised the concern that this turns a
hand-to-a-client demo into an app that needs a database; เกรพ confirmed on 2026-09-08 to
proceed. PIN-0001 already removed the false-success claims, so the demo is presentable in
the meantime.

**Q3 — Demo data only, permanently.** No real marketplace customer data enters this repo
or its database, per `CLAUDE.md`. The seeded names are fictional and the seed script is
the only writer of conversation content. Importing real chat history would be a separate
decision requiring its own privacy review — not part of this milestone.

**Q4 — Migration-on-deploy is UNVERIFIED.** The only evidence that Sites applies
generated SQL is a string the template author wrote in
`examples/d1/app/api/notes/route.ts`. There is no documentation in the repo, no wrangler
config to inspect, and no rollback story. Mitigations adopted:
- migrations stay **additive only** — no `DROP`, no destructive `ALTER` — so a partial
  apply cannot lose data;
- the claim gets tested on the first deploy with a throwaway table, before any view
  depends on D1.

## Ticket numbering

The breakdown above was written before PIN-0001 was spent on the honest-states work, so
the persistence tickets shift up by one: PIN-0002 is "Cloudflare types + D1 binding",
PIN-0003 is schema + first migration, and so on through PIN-0008.
