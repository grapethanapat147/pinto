# Deploying Pinto

**Status:** decided 2026-09-12. เกรพ chose **(a), a shareable demo**, which settles Q1–Q5.

Pinto has never been deployed. Everything in this document about how the pipeline behaves
was read out of the repository and the build output on 2026-09-12; everything marked
**unverified** is a claim that cannot be checked without actually deploying once.

## How a deploy works here

There is no `deploy` script and no `wrangler.toml`. The app is an **OpenAI Sites** project:
`.openai/hosting.json` carries `project_id: appgprj_6a8d155e87e0819180e9ba11ff04b4e4`, and
`@openai/sites-vite-plugin` packages the deployment metadata during `npm run build`.

What `npm run build` actually produces:

| path | what it is |
| --- | --- |
| `dist/server/index.js` | the Worker, 1.1 MB |
| `dist/client/` | static assets, 3.7 MB |
| `dist/server/wrangler.json` | generated binding manifest |
| `dist/.openai/hosting.json` | copied project metadata |
| `dist/.openai/drizzle/` | **all six migrations, copied into the artifact** |

So the control plane is handed the migrations. Whether it *applies* them is the single
biggest unknown in this document.

## What the audit turned up

### 1. The generated manifest is the local one
`dist/server/wrangler.json` ships `database_id: 00000000-0000-4000-8000-000000000000` — the
placeholder from `vite.config.ts`, which is explicitly the *local* binding config. It also
ships `"vars": {}` and `"secrets_store_secrets": []`.

`db/index.ts` already says what has to happen: *"let your control plane inject the real
binding values"*. That is the assumption the whole deploy rests on, and it is **unverified**.

### 2. There is no way to set the LINE secret in production
`LINE_CHANNEL_SECRET` reaches the Worker from `.dev.vars` locally. Nothing in this repo can
put it into production — `vars` is empty and there is no secrets mechanism wired up. Until
that exists, `lineConfig()` returns null in production and the login page honestly says LINE
is not connected, which is a safe default rather than a broken one.

`LINE_CALLBACK_URL` must also change to the deployed origin, **and that URL has to be added
to the channel in the LINE Developers Console**, or the callback is rejected by LINE.

### 3. The app still carries the template's name
`package.json` is `site-creator-vinext-starter`, and the generated worker inherits it as
`"name": "site-creator-vinext-starter"`. Cosmetic, but it is the name that will appear in
the hosting dashboard and in logs.

### 4. `IMAGES` is declared but never bound
`worker/index.ts` types an `IMAGES` binding and uses it for `/_vinext/image`. That binding is
in neither `vite.config.ts` nor the generated manifest. Nothing in the app requests that
path — every image is a plain `<img>` pointing at `public/pinto/` — so this is latent, not
broken. It becomes a real failure the moment anyone reaches for `next/image`.

### 5. Dependency advisories are build-only
`npm audit` reports 23 (16 high). All six affected direct packages are `devDependencies`:
`@cloudflare/vite-plugin`, `drizzle-kit`, `react-server-dom-webpack`, `vinext`, `vite`,
`wrangler`. `vinext` and `vite` are referenced inside `dist/server/`, so their *runtime*
pieces do ship; the others leave no trace in the bundle.

This is a build-chain risk rather than an exposed-surface one, but "devDependency" is not the
same as "not shipped" and the two that do ship deserve a look at which advisories apply.

### 6. Production starts empty
`scripts/local-db.mjs` says outright that production seeding is out of scope, and every npm
script that touches data is named `db:local:*`. A freshly migrated production database has
no shops, no users, no products.

That matters more than it sounds:

- With no `shops` row, nothing can be scoped to a shop.
- With no `users` row, **nobody can sign in at all.** The demo button looks up seeded
  `demo-owner` / `demo-staff` rows and returns 500 when they are absent; LINE refuses any
  identity without a row.
- `npm run auth:grant-line` writes to the local miniflare SQLite file by path. It cannot
  reach production.

PIN-0008's honest states mean the app will render an empty dashboard rather than crash, but
the front door will be locked with nobody holding a key.

## Decisions

เกรพ chose **(a)** on 2026-09-12: the deployment is a **shareable demo**, not a real shop.
That answer carries the rest.

| | decision |
| --- | --- |
| Q1 purpose | A shareable demo. |
| Q2 demo sign-in | **Ships.** Every row in that database is public by design. |
| Q3 bootstrap | Seed on deploy, gated so it only ever runs into an empty database. |
| Q4 migrations | Settle by deploying once and looking. Cannot be reasoned about. |
| Q5 advisories | After the first deploy, as their own change. |

**The consequence to hold on to:** the deployed database is public. Anyone with the link
presses one button and is the shop owner, with payouts and profit. Nothing real may ever be
put in it. If Pinto later needs a real shop, that is a second deployment with the demo
provider removed, not this one with extra care taken.

Q4 has to come first. If migrations are not applied there are no tables, so there is nothing
for a seed to write into and the shape of Q3's answer changes completely. That ordering is
why the work splits into two tickets rather than one.

## The questions as they were asked

### Q1 — What is the deployed Pinto *for*?
This decides everything below it.

- **(a) A shareable demo.** เกรพ sends a link to a client; they press the demo button and
  look around. Needs the seed in production and the demo provider enabled.
- **(b) A real single shop.** เกรพ signs in with LINE and it holds real data. Needs a shop
  row, his LINE user row, and the demo button gone.
- **(c) Both, with the demo shop separate from any real one.** Most work; the shop scoping
  from PIN-0012 already supports it.

**Recommendation: (a).** Pinto's stated purpose all along has been showing clients a working
prototype, and (b) means committing to real merchant data with no backup story, no incident
plan, and a channel adapter layer that is still a demo adapter.

### Q2 — Does the one-click demo sign-in ship?
It hands anyone who opens the URL owner access to the seeded shop, including payouts and
profit. That is exactly right for (a) and wrong for (b).

**Recommendation:** ship it under (a), and treat every row in that database as public. Never
put a real merchant's data in the same deployment as an open demo button.

### Q3 — How does anyone get a production shop and user row?
Three ways:

- **(i) Seed on deploy**, the same fixtures as local. Simple, and under (a) the demo data is
  the point.
- **(ii) A one-time bootstrap endpoint** guarded by a secret. More moving parts, and a
  guarded write endpoint is a thing to get wrong.
- **(iii) Apply SQL by hand** through the control plane's database console, if it has one.

**Recommendation: (i)**, gated so it runs only into an empty database and never overwrites.

### Q4 — Are migrations actually applied on deploy?
The artifact contains them. Nothing observed proves the control plane runs them.

**This must be settled by deploying once and looking**, not by reasoning. If they are not
applied, every page renders `DataUnavailable` because the tables do not exist, and the
fallback path from PIN-0008 gets its first real-world exercise.

### Q5 — Fix the advisories before or after the first deploy?
**Recommendation: after.** The first deploy answers Q4, which is the thing blocking
everything else, and a dependency bump is a change that wants its own verification rather
than being tangled up with the first production run.

## What a first deploy should establish

In order, because each answer changes the next step:

1. The build artifact is accepted at all.
2. Migrations are applied — check whether any table exists.
3. The database is reachable from the Worker, so the real `DB` binding was injected.
4. Whether anything can be signed in as.
5. Whether the assets under `public/pinto/` are served — the brand marks, the favicon, the
   OG image at its absolute URL.

## Not in scope
Custom domains, rollback procedure, uptime monitoring, backups, and the LINE production
channel. Each is a separate decision once there is a running deployment to attach it to.
