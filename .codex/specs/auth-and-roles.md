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
- **WebCrypto PBKDF2 is available** — `deriveBits` with SHA-256 returns 32 bytes. No WASM
  and no native dependency needed, which matters because bcrypt does not run on Workers.

## Proposed design

### Storage
Two additive tables:

```
users      id · shop_id · email · password_hash · password_salt · role · name · created_at
sessions   id (token) · user_id · shop_id · expires_at · created_at
```

Sessions live in D1 rather than in a signed cookie, so **logout can actually revoke** —
a stateless JWT cannot be invalidated before it expires.

### Password handling
PBKDF2-SHA256, per-user random salt, high iteration count, hash compared in **constant
time**. Never log or return the hash or salt. This is the one part of this milestone where
a shortcut is a real vulnerability rather than a rough edge, so it gets its own review.

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

## Proposed tickets

| Ticket | Title |
| --- | --- |
| PIN-0011 | Users, sessions and password hashing |
| PIN-0012 | Login, logout, and the demo sign-in button |
| PIN-0013 | Session-scoped queries — retire `SHOP_ID = 1` |
| PIN-0014 | Roles: staff cannot read finance |

PIN-0013 is the one that touches 21 call sites; it should land on its own.

## Acceptance criteria (whole spec)

- [ ] `SHOP_ID = 1` no longer exists; every query and mutation scopes to the session's shop.
- [ ] An unauthenticated request to `/` reaches the login page, not the dashboard.
- [ ] Passwords are PBKDF2-hashed with a per-user salt and compared in constant time.
- [ ] Logout revokes the session server-side, not just client-side.
- [ ] `staff` cannot obtain finance data even by crafting the request directly.
- [ ] The demo is still one click from the login page.
- [ ] Tests cover: wrong password, expired session, revoked session, cross-shop access,
      and a `staff` request for finance data.
- [ ] `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` pass.

## Questions for เกรพ

1. **Confirm (c) for the demo problem?** It shapes the login page.
2. **Are two roles enough**, or does Pinto want a third (e.g. an accountant who sees
   *only* finance)?
3. **Seeded demo credentials** — what email should the demo owner use? It goes in the
   repo, so it must be obviously fake, and the password must be treated as public.
4. **Is a password the right factor at all?** Real Thai merchants would expect LINE Login
   or a phone OTP. Both need external setup that does not exist yet, so this spec assumes
   email + password as the self-contained option — but if LINE Login is the actual
   destination, building password auth first may be throwaway work.
