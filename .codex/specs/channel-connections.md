# Connecting a real sales channel

**Status:** UI decisions taken; the credential and token questions are deliberately still open.

เกรพ asked for **Shopee and TikTok Shop first**, and for the **UI to be built ahead of the
actual API work** — "ส่วนลิ้งก์เดี๋ยวค่อยว่ากันครับ".

## What exists already

The seam is in place and load-bearing:

| piece | state |
| --- | --- |
| `channels` table | shop-scoped, with `code`, `kind`, and display metadata |
| `channel_health` table | `healthy \| syncing \| degraded \| **disconnected**` per channel |
| `ChannelAdapter` interface | `createDemoAdapter` is the only implementation |
| the sync grid on Stock | already renders real per-channel health |
| a "จัดการการเชื่อมต่อ" button in the sidebar | honestly says the page does not exist yet |

So `disconnected` is already a first-class state that the data model and the UI understand.
The missing piece is a page where a shop owner can *act* on it.

## The rule this page has to obey

PIN-0001 exists because the prototype simulated success. A "เชื่อมต่อ Shopee" button that
appears to work and does nothing would be the worst possible version of this page.

**The LINE Login pattern from PIN-0014 is the answer**, and it is already proven here:
`lineConfig()` returns null when the channel is not configured, so the login page renders a
disabled button *with the reason* instead of a live one. Same shape:

- A provider reports whether it is configured.
- Configured → the button starts a real OAuth flow.
- Not configured → the button is disabled and the page says why.

When เกรพ gets Shopee and TikTok credentials, the providers become real and **the UI does not
change**. That is the point of building it now.

## UI decisions taken

1. **A ninth view, `connections`**, reachable from the sidebar's existing "จัดการการเชื่อมต่อ"
   button. `View`, `navItems` and `viewTitles` stay synchronized, as CLAUDE.md requires.
   It goes in the "จัดการร้าน" group, at the end — it is a settings screen, not daily work.
2. **One card per channel**, showing its real state from `channel_health`, when it last
   synced, and one primary action appropriate to that state.
3. **Owner only.** Connecting a sales channel is not a packing assistant's job. Enforced on
   the server like the finance data in PIN-0013, not by hiding the nav item.
4. **No fake progress.** No spinner that resolves to success, no optimistic state. A channel
   is connected when the database says so.

## Deliberately NOT in this ticket

**Token storage.** Storing marketplace access and refresh tokens is a security decision, not a
UI one, and D1 has no encryption at rest. Guessing a shape now and building the UI on top of
it would bake in the guess. The UI needs none of it: it renders `channel_health`, which
already exists.

That question gets asked properly when there are real credentials to store.

## Open questions, for when the API work starts

### Q1 — Where do access and refresh tokens live?
D1 rows are plaintext at rest. Options are a `channel_connections` table with
application-level encryption using a Worker secret, Cloudflare's Secrets Store, or KV. This
needs answering **before** the first real OAuth callback, not after.

### Q2 — What does "disconnect" do to data already synced?
Keep the orders and mark the channel disconnected, or remove them? Keeping is almost certainly
right — the shop still sold those things — but it should be a decision, not a default.

### Q3 — Can one shop connect two accounts on the same marketplace?
`channels` is unique on `(shop_id, code)`, so today: no. Some merchants run two Shopee shops.
Changing that later is a migration; knowing now is cheap.

### Q4 — Who refreshes tokens, and what happens when refresh fails?
`channel_health` already has `degraded` and a `detail` string, which is the right place for
"needs reconnecting". The mechanism is the open part.
