# Pinto — Claude Code Handoff

## Product

Pinto is a Thai-language seller operations dashboard for online merchants who sell across TikTok Shop, Shopee, and LINE MyShop. The product goal is to help a shop owner understand what needs attention today without switching between multiple back offices.

The current project is an interactive front-end demo. It uses realistic sample data but does not yet connect to marketplace APIs, persist edits, or perform real financial/fulfilment actions.

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
- Framework: React 19 + vinext/Vite for Cloudflare-compatible output
- Main UI: `app/page.tsx`
- Design system and responsive styles: `app/globals.css`
- Fonts and social metadata: `app/layout.tsx`
- Static assets: `public/`
- Optional database foundation: `db/` + Drizzle
- Cloudflare worker entry: `worker/index.ts`
- Sites project metadata: `.openai/hosting.json`

The app is intentionally concentrated in one page component for the prototype. Before adding substantially more features, split views and sample data into focused modules while keeping the current behavior unchanged.

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
- Base text should remain comfortably readable; avoid adding text below 10 px

When changing responsive behavior, verify at least these widths:

- 1440 px desktop
- 1024 px compact desktop/tablet
- 760 px mobile navigation breakpoint
- 390 px phone

## Important implementation notes

- Keep `View`, `navItems`, and `viewTitles` synchronized when adding or removing a major section.
- Keep the mobile navigation limited to the highest-frequency tasks; route remaining sections through the existing “More” sheet.
- The current action, order, inventory, campaign, payout, and conversation data are sample constants in `app/page.tsx`.
- Toasts and UI state demonstrate workflows only. Do not present them as successful marketplace actions until a real backend confirms the operation.
- Preserve `.openai/hosting.json` if continuing to deploy to the existing Sites project. Do not store API keys or secrets in that file.
- Do not commit `.env`, credentials, access tokens, build output, or marketplace customer data.

## Recommended next development milestones

1. Extract each major view into `app/components/` and move demo records into typed fixtures.
2. Add server-side persistence for products, inventory, orders, conversations, and actions.
3. Define a normalized channel adapter interface before implementing TikTok Shop, Shopee, and LINE integrations.
4. Add authenticated, shop-scoped data access and role permissions.
5. Add loading, empty, partial-sync, expired-token, and integration-error states.
6. Add tests for filtering, navigation, message sending, stock alerts, and responsive menu behavior.

## Definition of done for future changes

- The main user workflow is complete, not only visually mocked.
- Desktop and mobile layouts remain readable without clipped controls.
- Empty, loading, error, and success states are covered.
- `npm run build` succeeds.
- New external actions are never simulated as real success unless confirmed by the backend.
