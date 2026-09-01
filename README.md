# Pinto Seller Operations Center

Pinto is a Thai-language operations dashboard for online merchants selling across TikTok Shop, Shopee, and LINE MyShop. It brings daily work—orders, customer messages, stock, marketing, and profit—into one simple workspace.

This repository currently contains an interactive product demo with sample data. Marketplace integrations and persistent backend storage are not included yet.

## Requirements

- Node.js `>=22.13.0`
- npm

## Run locally

```bash
npm install
npm run dev
```

Use the local URL printed in the terminal.

## Validate

```bash
npm run build
npm run lint
```

## Main files

- `app/page.tsx` — dashboard views, sample data, and interactive demo state
- `app/globals.css` — visual system and responsive behavior
- `app/layout.tsx` — Thai font configuration and social metadata
- `public/` — favicon and social preview assets
- `.openai/hosting.json` — existing Sites project metadata
- `CLAUDE.md` — detailed handoff instructions for Claude Code

## Current product areas

- Today overview and quick work shortcuts
- Action Center
- Multi-channel orders
- Unified customer inbox
- Products and inventory
- Customer insights
- Growth and advertising
- Finance and payouts

## Important

The interface uses demo data. Buttons that show a confirmation toast do not perform real marketplace, inventory, payment, or fulfilment operations.
