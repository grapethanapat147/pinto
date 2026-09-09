# Spec — Authentication, shop scoping and roles

Milestone 4 from `CLAUDE.md`: *"Add authenticated, shop-scoped data access and role
permissions."*

Brought forward ahead of milestone 3, because an adapter needs per-shop credentials before
it can be anything more than an interface — see `.codex/specs/channel-adapters.md` Q1.

## Where the app actually stands

The groundwork is done. Spec D5 put a non-null `shop_id` on all 18 tables specifically so
this milestone would be a filter change rather than a rewrite. What remains is genuinely
narrow:

- **`SHOP_ID = 1` is a hardcoded constant in two files** — `db/queries.ts` and
  `db/mutations.ts` — used at **21 call sites**. Every query and every write already
  filters by shop; they just all filter by the same literal.
- There is no `users` table, no session, and nothing that identifies a caller.

So the work is: establish who is calling, then replace one constant.

## Verified 2026-09-09

- **`next/headers` works in this stack.** A probe route reading `cookies()` and `headers()`
  built and returned `{"cookieApi":"function","headerApi":"function","host":"localhost"}`
  from the built worker. Session state can be read in server components. (Probe deleted.)
- **WebCrypto is available** — checked `crypto.subtle` and `crypto.getRandomValues` in the
  worker runtime. Relevant now only for generating session tokens; the PBKDF2 check that
  prompted it is moot since no password is ever stored.

## Proposed design

### Storage
Two additive tables:

```
users      id · shop_id · provider · provider_user_id · display_name · picture_url · role · created_at
           unique(provider, provider_user_id)
sessions   id (token) · user_id · shop_id · expires_at · created_at
```

No password columns — see the resolution below. Identity comes from an external provider,
so a user row is `(provider, provider_user_id)` and nothing secret is stored at all.

Sessions live in D1 rather than in a signed cookie, so **logout can actually revoke** —
a stateless JWT cannot be invalidated before it expires.

### Identity providers
The session layer is provider-agnostic; a provider's only job is to return a verified
`(providerUserId, displayName, pictureUrl)`.

- **`line`** — LINE Login (OAuth 2.0 / OIDC). Needs a LINE Login channel; the channel
  secret is a Cloudflare secret, never `.openai/hosting.json` (`CLAUDE.md` forbids secrets
  there) and never committed.
- **`demo`** — signs in the seeded demo owner with no external call. This is what makes the
  demo one click, and being a real provider row means it is *visible* in the database
  rather than a hidden bypass.

Storing no passwords removes the largest security surface of this milestone outright.

### Cookie
`HttpOnly`, `SameSite=Lax`, `Secure` in production, with an explicit expiry matching the
session row.

### Shop scoping
Every query and mutation takes the shop from the session instead of the constant.

**Threaded explicitly as a parameter, not via AsyncLocalStorage.** Ambient context makes
it possible to forget the filter and never notice; a required parameter makes an unscoped
query fail to compile. With 21 call sites, "impossible to forget" is worth the verbosity.

### Roles
Two, chosen because they map to something a real shop does:

| Role | Sees |
| --- | --- |
| `owner` | everything |
| `staff` | everything except Money — payouts, profit, withdrawable balance |

A shop owner would not show payout accounts to a packing assistant. Enforced on the
**server**, not by hiding a nav item: `staff` requesting money data gets nothing back, so
the check cannot be bypassed by editing client state.

## The demo problem

Today anyone opening the URL sees the dashboard. A login wall means เกรพ has to hand out
credentials before showing a client anything — which would make this milestone actively
harmful to Pinto's main current use.

Three ways out:

- **(a) Login required.** Realistic; adds friction to every demo.
- **(b) Auto-login when no session.** Frictionless; auth is then not really enforced, which
  makes the whole milestone decorative.
- **(c) Login required, with a "เข้าสู่ระบบตัวอย่าง" button on the login page** that signs
  in the seeded demo owner in one click.

**Recommendation: (c).** Real auth is genuinely enforced, and a demo still costs one click
with nothing to remember or type.

## Acceptance criteria (whole spec)

- [ ] `SHOP_ID = 1` no longer exists; every query and mutation scopes to the session's shop.
- [ ] An unauthenticated request to `/` reaches the login page, not the dashboard.
- [ ] No secret of any kind is stored on a user row.
- [ ] Logout revokes the session server-side, not just client-side.
- [ ] `staff` cannot obtain finance data even by crafting the request directly.
- [ ] The demo is still one click from the login page, via a visible `demo` provider.
- [ ] Tests cover: expired session, revoked session, forged token, cross-shop access,
      and a `staff` request for finance data.
- [ ] `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` pass.

## Resolved 2026-09-09

**Q4 → LINE Login is the destination; password auth is skipped entirely.** เกรพ confirmed
Thai merchants expect LINE, so building email/password first would have been throwaway
work. The `users` table carries no secret of any kind.

**Q1 and Q3 → dissolved by that decision.** The demo sign-in is no longer a pre-shared
password but a `demo` provider, so there are no credentials to put in the repo.

**Q2 → still open.** Two roles (`owner`, `staff`) are assumed until told otherwise.

## What can and cannot be verified yet

A LINE Login channel does not exist for Pinto, so the `line` provider can be **written but
not exercised** — the OAuth round trip cannot be proven without a real channel id, secret
and registered redirect URI.

That is why the work splits with the provider-agnostic parts first: sessions, the demo
provider, scoping and roles are all fully testable today, and the LINE provider lands
behind them as the one piece waiting on เกรพ's LINE Developers Console.

## Revised tickets

| Ticket | Title | Blocked? |
| --- | --- | --- |
| PIN-0011 | Users, sessions, and the demo provider | no |
| PIN-0012 | Session-scoped queries — retire `SHOP_ID = 1` | no |
| PIN-0013 | Roles: staff cannot read finance | no |
| PIN-0014 | LINE Login provider | needs a LINE Login channel |

PIN-0012 is the one that touches 21 call sites; it should land on its own.
