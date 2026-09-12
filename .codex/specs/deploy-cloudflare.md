# Deploying Pinto to Cloudflare directly

**Status:** draft, awaiting decisions on Q1–Q6.

The alternative to `.codex/specs/deploy.md`'s OpenAI Sites route. เกรพ asked for this one
because **nobody here knows the Sites procedure**: there is no `openai`, `codex` or `chatgpt`
CLI on the machine, no CI, no deploy script, and no documentation of it anywhere in the repo.
`.openai/hosting.json` names a project and the build plugin packages metadata for it, and
that is the entire extent of what is known.

This route is knowable. Everything below marked ✅ was run and observed on 2026-09-12, not
reasoned about.

## The account that already exists

เกรพ is logged into Wrangler 4.92.0, which ships with the project:

```
grapethanapat147@gmail.com
Account ID a023e0d5b78c183678dec01227353f12
```

Nothing in this document has been executed against that account. The checks below all ran
locally or as dry runs.

## What was verified

### ✅ The build artifact deploys as-is
`wrangler deploy --dry-run -c dist/server/wrangler.json` succeeds against the generated
manifest, with no hand-editing:

| | |
| --- | --- |
| worker bundle | 51 modules, 646 KiB |
| static assets | 46 files from `dist/client` |
| total upload | 834 KiB, 240 KiB gzipped |
| bindings recognised | `env.DB` as a D1 Database |

**Only `DB` is bound.** The `IMAGES` binding that `worker/index.ts` types and uses for
`/_vinext/image` does not appear — confirming finding 4 of the Sites spec from the other
direction.

### ✅ Drizzle's migrations are consumable by Wrangler
This was the real unknown, and both halves of it turned out fine.

`migrations_dir` belongs **inside the `d1_databases` entry**, not at the top level — put it at
the top level and Wrangler warns `Unexpected fields found` and then looks in `./migrations`.
With it in the right place, all six are found and `drizzle/meta/` is ignored rather than
tripping it up.

Applied against a throwaway local database: **all six succeed**, producing 25 tables —
the 22 the schema defines plus `d1_migrations`, which is Wrangler's own tracking table, and
SQLite's internal two. Drizzle's `--> statement-breakpoint` comments are no obstacle.

That means **migrations are a solved problem on this route**, which is exactly the question
the Sites route cannot answer without deploying blind.

The working local database was untouched throughout: 3 users and 15 sessions before and
after.

## What is not solved

### The generated manifest is rebuilt every time
`dist/server/wrangler.json` carries `database_name: site-creator-d1` and
`database_id: 00000000-0000-4000-8000-000000000000`, both from `vite.config.ts`'s
**local** binding config. `npm run build` overwrites the file, so hand-editing it is not a
fix — it is a change that disappears on the next build. Q1 is about where the real values
should live instead.

### The secret has somewhere to go, at last
`wrangler secret put LINE_CHANNEL_SECRET` exists on this route. That is a genuine advantage
over Sites, where nothing in the repo can set it. `LINE_CALLBACK_URL` becomes the deployed
origin and must then be registered on the LINE channel, or LINE rejects the callback.

### Cost
Workers and D1 both have free tiers. **The current limits should be read before deploying**
rather than quoted from memory here, and the demo's traffic is a handful of visits, so the
question is whether anything about it falls outside a free tier at all — not whether it is
cheap.

## Open questions

### Q1 — Where do the real database id and name live?
`vite.config.ts` builds the manifest from a placeholder. Three ways:

- **(a) A committed `wrangler.json` at the repo root**, used only for `deploy` and the `d1`
  commands, holding the real database name and `migrations_dir: drizzle`. The generated
  manifest stays local-only. A database id is not a secret — it is a public identifier — so
  committing it is fine.
- **(b) Teach `vite.config.ts` to read them from the environment**, so one manifest serves
  both. Fewer files, but it makes the local dev config depend on production values being
  absent, which is the kind of conditional that breaks quietly.
- **(c) A deploy script that patches the generated file.** Works, and is the one that will
  rot, because it depends on the shape of a file another tool owns.

**Recommendation: (a).** Two configs for two jobs, each simple, and the local one keeps
working exactly as it does now.

### Q2 — What is the D1 database called?
The manifest says `site-creator-d1`, inherited from the template. `pinto` matches the worker
name and the repo.

**Recommendation:** `pinto`. Names are hard to change later, and the template's name is
already being removed elsewhere (PIN-0020).

### Q3 — What happens to the OpenAI Sites project?
`.openai/hosting.json` stays in the repo and the build plugin keeps packaging it. If Pinto
lives on Cloudflare, that metadata describes a deployment nobody uses, and CLAUDE.md's
instruction to preserve the file assumes it is still the target.

- **(a) Leave it.** Harmless, but the repo then claims two deployment targets and a future
  reader has to work out which is real.
- **(b) Remove the plugin and the file**, and record why in CLAUDE.md.

**Recommendation: leave it for now, decide after the first successful Cloudflare deploy.**
Removing it forecloses the Sites route while that route is still merely unknown, not ruled
out — เกรพ may yet find the button.

### Q4 — `IMAGES`: bind it or delete the code path?
`worker/index.ts` handles `/_vinext/image` using a binding that will not exist. Nothing in
the app requests that path — every image is a plain `<img>` at `public/pinto/`.

- **(a) Bind Cloudflare Images.** Costs money and buys nothing today.
- **(b) Delete the branch** and let the route 404 until something needs it.
- **(c) Leave it.** It throws if ever reached.

**Recommendation: (b).** Dead code that fails at runtime is worse than absent code, and this
is the same honesty rule as PIN-0001 applied to a route instead of a button.

### Q5 — Does the demo seed still work the same way?
`.codex/specs/deploy.md` Q3 chose seed-on-empty from inside the Worker, because the Sites
control plane offers no other hook. On this route there is a second option:
`wrangler d1 execute --remote --file` against a seed SQL file, run once by hand.

- **(a) Seed-on-empty in the Worker**, as already designed in PIN-0021. Works on either
  route, so the ticket survives a change of mind about hosting.
- **(b) Seed by hand with Wrangler.** Simpler code — none at all — but it is a step someone
  has to remember, and a wiped database stays broken until they do.

**Recommendation: (a)**, unchanged. The design should not depend on which host won.

### Q6 — `workers.dev` subdomain, or a custom domain?
A `workers.dev` URL is free and immediate. A custom domain needs DNS on Cloudflare.

**Recommendation:** `workers.dev` for the demo. The URL is for sending to a client, not for
a brand.

## What a first deploy would look like

Once Q1 and Q2 are answered, and **only with เกรพ's approval at each step that touches the
account**:

1. `wrangler d1 create pinto` — returns the real database id.
2. Put the id and name in the root config from Q1.
3. `wrangler d1 migrations apply pinto --remote` — expected to behave exactly as the local
   run did, since it is the same six files through the same command.
4. `wrangler deploy -c dist/server/wrangler.json` with the D1 binding pointed at the real
   database. **The manifest question from Q1 has to be solved before this step**, not during.
5. Open the URL and run the same six checks PIN-0020 lists.

Steps 1, 3 and 4 create or modify things in เกรพ's Cloudflare account and are his to
approve. I will not run them on my own initiative.

## Which route to take
Not a question I should answer alone, but the evidence so far:

| | Sites | Cloudflare |
| --- | --- | --- |
| procedure known | no | yes |
| migrations | unverified | ✅ verified working |
| LINE secret | no mechanism in repo | `wrangler secret put` |
| account needed | already exists | already exists |
| cost | unknown | free tier, to be confirmed |
| who presses deploy | เกรพ, somewhere unknown | either of us, from this repo |

The deciding fact is the first row. If เกรพ finds the Sites deploy button, that route is
cheaper and simpler. If he cannot, this one is entirely within reach.
