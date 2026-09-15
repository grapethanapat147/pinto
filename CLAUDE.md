# Pinto — Claude Code Handoff

## Product

Pinto is a Thai-language seller operations dashboard for online merchants who sell across TikTok Shop, Shopee, and LINE MyShop. The product goal is to help a shop owner understand what needs attention today without switching between multiple back offices.

The app is **deployed and working** at https://pinto.grapethanapat147.workers.dev as a
shareable demo. It persists to a real database, has real authentication, and enforces roles
on the server. What it does **not** have is any connection to a marketplace: TikTok Shop,
Shopee and LINE MyShop are served by `createDemoAdapter`, so no order is really fetched and
no fulfilment or payout is really performed. That is the line between this and a product.

**The deployed database is public.** Anyone with the link presses one button and is the shop
owner, with payouts and profit. Every row in it is demo data by design. Nothing real may go
in it — a real shop would be a second deployment with the demo provider removed.

## Product principles

- Keep the interface simple, warm, and friendly for non-technical Thai merchants.
- Prioritize daily decisions: orders, customer messages, stock, campaigns, and cash flow.
- Use plain Thai copy. Keep official platform and technical names in English where clearer.
- Make the primary action obvious and avoid showing too many equal-priority controls.
- Preserve keyboard accessibility, visible focus states, and comfortable touch targets.
- Use `lucide-react` for icons. Do not use Unicode symbols as interface icons.
- Buttons containing an icon and text must remain horizontally aligned using the existing `icon-text-button` pattern or equivalent flex styles.

## Current features

- Today dashboard with profit overview, channel performance, calendar, payouts, and quick work shortcuts
- Action Center with filters and an interactive resolution drawer
- Multi-channel order list with search and status filters
- Unified customer inbox with channel filters, suggested replies, and demo message sending
- Product and inventory overview with low-stock states, restock recommendations, and channel sync status
- Growth/ads overview and product opportunities
- Customer segments and regional distribution
- Finance, profit waterfall, and payout schedule
- Responsive desktop, compact sidebar, mobile bottom navigation, and a mobile “More” sheet

## Technical shape

- Runtime: Node.js `>=22.13.0`
- Package manager: npm
- Framework: React 19 + vinext/Vite, building a Cloudflare Worker
- Views: 18 components under `app/components/`; `app/page.tsx` is a 112-line server component
  that loads data and hands it to `AppShell`
- Fixtures: `app/fixtures/` — the source of truth for the seed, imported never copied
- Database: **required**, not optional. Cloudflare D1 + Drizzle in `db/`; nothing renders
  without it. Migrations in `drizzle/`
- Auth: `db/auth.ts` + `app/api/auth/` — LINE Login and a one-click demo provider
- Design system and responsive styles: `app/globals.css`
- Delivered design tokens: `.codex/specs/design-system/` — the source of truth for the
  palette, guarded by `tests/design-tokens.test.mjs`
- Brand artwork: `public/pinto/`, behind `app/components/PintoBrand.tsx`
- Worker entry: `worker/index.ts`
- Deploy config: `wrangler.deploy.jsonc` (**not** `wrangler.json` — see the traps below)
- Specs and the Kanban board: `.codex/specs/` and `.codex/tasks/` with `PIN-*` tickets

## Traps that have already cost time

**`@media` blocks live at the end of `app/globals.css`, and must stay there.** The file is
five appended design layers. Media queries add no specificity, so a plain rule written below
them wins at every width — that silently killed 52 declarations and made the dashboard scroll
sideways on a phone. Add new plain rules **above** the responsive-layer header.
`tests/css-cascade.test.mjs` fails if one goes below.

**Secrets go in `.dev.vars`, never `.env.local`.** Only `.dev.vars` reaches the Worker's `env`
from `cloudflare:workers`; `.env.local` populates `import.meta.env`, which nothing reads for
bindings. Verified with a probe route, not assumed.

**`scripts/seed.ts` is destructive.** It opens with `DELETE FROM` across 22 tables including
`users` and `sessions`. `npm run db:remote:seed` therefore refuses on a non-empty database.

**A LINE user id is scoped to the provider, not the channel.** Moving a channel to a different
provider issues a different id for the same person, and granted access stops matching.

## Running and deploying

```bash
npm run dev                  # local, port 5173
npm test                     # builds, then 47 tests
npm run deploy               # build + Cloudflare
npm run db:local:reset       # migrate + seed the local D1
npm run auth:grant-line      # grant a LINE account access (add -- --remote for production)
```

`npm run deploy` merges the real D1 binding from `wrangler.deploy.jsonc` into the manifest the
build generates, and **refuses** if that manifest is not the shape it expects rather than
deploying something nobody chose.

## Quick start

```bash
npm install
npm run dev
```

Then open the local URL printed by the dev server.

Useful checks:

```bash
npm run build
npm run lint
```

## Design system

- Thai UI font: Noto Sans Thai
- Primary accent: burnt orange `#C85410`
- Main canvas: warm ivory `#F5F0EC`
- Main text: charcoal `#211D1B`
- Cards: white with subtle warm borders and low-contrast shadows
- Icons: Lucide, generally 18–21 px with approximately 1.9 stroke width
- Base text 15px / 1.55. **Nothing below 11px, and Thai labels want 13px** — the delivered
  system's floor. The original prototype was drawn in miniature and was scaled up in PIN-0018
- Cards: white on `#F5F0EC`, 1px `#EBE4DF` border, radius 8px, **no shadows**
- Buttons: radius 7px, 44px tap target; a secondary button is plain text
- Roughly four orange elements per screen — it marks what needs action, not decoration

When changing responsive behavior, verify at least these widths:

- 1440 px desktop
- 1024 px compact desktop/tablet
- 760 px mobile navigation breakpoint
- 390 px phone

## Important implementation notes

- Keep `View`, `navItems`, and `viewTitles` synchronized when adding or removing a major section.
- Keep the mobile navigation limited to the highest-frequency tasks; route remaining sections through the existing “More” sheet.
- Action, order, inventory, campaign, payout and conversation data all come from D1. The
  fixtures under `app/fixtures/` seed it; they are not read at request time.
- Every query and mutation takes the caller's session and scopes to `session.shopId`. It is
  threaded as a parameter on purpose, so an unscoped query fails to compile.
- `staff` must never receive finance data. It is withheld on the **server**, not by hiding a
  nav item.
- Toasts and UI state demonstrate workflows only. Do not present them as successful marketplace actions until a real backend confirms the operation.
- Deploy with `npm run deploy`. The OpenAI Sites target was removed in PIN-0024; `git revert` that commit if it is ever wanted back.
- Do not commit `.env`, credentials, access tokens, build output, or marketplace customer data.

## Where the work stands

All six of the original milestones are done — views extracted, persistence, the channel
adapter interface, auth and roles, honest states, and tests. 22 tickets closed, tracked in
`.codex/tasks/done.md`.

**What is actually left, in order of weight:**

1. **No marketplace is really connected.** `createDemoAdapter` is the whole of it. Doing this
   properly needs API credentials per platform, an OAuth flow per platform, token refresh, and
   a sync strategy — and it is what separates a good demo from a product.
2. **Never tested under real data volume.** The demo shop has a handful of rows. Pagination,
   query cost and D1's limits are all unexercised.
3. **No backup or rollback story** for the deployed database.
4. **4 npm advisories** left deliberately: all `drizzle-kit` → `esbuild`, where npm's only
   offered fix is a thirteen-version downgrade. Revisit when a forward fix ships.
5. **Type and query volume are untested at scale.** The demo has a handful of rows per table.

## Definition of done for future changes

- The main user workflow is complete, not only visually mocked.
- Desktop and mobile layouts remain readable without clipped controls, checked at
  **1440 / 1024 / 760 / 390**.
- Empty, loading, error, and success states are covered.
- `npx tsc --noEmit`, `npm run build`, `npm run lint` and `npm test` all pass.
- New external actions are never simulated as real success unless confirmed by the backend.

**Verify by measurement, not by assertion.** This is the house style and it has caught more
real bugs here than reading the diff ever did: query the database, diff the served HTML per
role, measure the rendered DOM, render the page and look at it. And **falsify every new test**
by breaking the thing it guards — several tests here passed against broken code until that was
done, including one that searched the whole document and matched the serialised props instead
of the markup.
