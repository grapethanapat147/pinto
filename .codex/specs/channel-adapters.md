# Spec — Channel adapters

Milestone 3 from `CLAUDE.md`: *"Define a normalized channel adapter interface before
implementing TikTok Shop, Shopee, and LINE integrations."*

## A caveat worth stating first

An adapter interface with **zero real implementations is designed against guesses**.
Interfaces get their real shape from the second and third implementation, not the zeroth,
and a speculative one usually turns out wrong in the places that matter.

So this spec deliberately does **not** try to anticipate what TikTok Shop's API needs. It
covers only what the app already does with channels today, and adds one real
implementation — a demo adapter over the seeded database — so the interface is
load-bearing rather than aspirational. A real integration will change it, and that is
expected.

What that buys now is concrete, not theoretical: it fixes three real defects.

## The three defects, all verified 2026-09-09

### F1. The same channel mapping is written three times
`db/queries.ts` lines 58, 146 and 181:

```ts
channel: row.channelCode === "line" ? "LINE" : row.channelCode === "shopee" ? "Shopee" : "TikTok"
```

Duplicated in `listOrders`, `listConversations` and (a variant) `listCampaigns`. Worse
than duplication: the final `: "TikTok"` means **any unrecognised channel silently renders
as TikTok**. Add a fourth marketplace and orders from it are mislabelled, with nothing
failing.

### F2. Components derive CSS classes by sniffing display text
- `InboxView`: `` `channel-logo ${conversation.channel.toLowerCase()}` ``
- `TodayView`: `payout.platform.startsWith("TikTok") ? "tiktok" : … "line"`

The visual identity of a channel is being recovered from its human-readable label. Rename
`LINE MyShop` to `LINE Shopping` and the logo silently loses its colour.

### F3. Channel sync status is hardcoded JSX
`StockView`'s sync grid is three literal blocks — `TikTok Shop / ซิงก์ล่าสุด 1 นาทีที่แล้ว /
ปกติ` and two more. This is exactly what an adapter owns: whether the connection is
healthy and when it last ran. It cannot ever show a real problem.

Related: `inventory_levels.sync_state` holds Thai prose (`ครบ 3 ช่องทาง`,
`TikTok รออัปเดต`) — a per-channel fact flattened into one denormalised string on the
product.

## Proposed shape

### The interface
Narrow, and only over operations the app performs today:

```ts
type ChannelAdapter = {
  readonly channel: ChannelIdentity;        // code, displayName, shortName, kind, accent
  health(): Promise<ChannelHealth>;         // state + lastSyncedAt — feeds F3's grid
  listOrders(since?: string): Promise<NormalizedOrder[]>;
  listConversations(since?: string): Promise<NormalizedConversation[]>;
  sendMessage(conversationRef: string, body: string): Promise<SendResult>;
  listInventorySync(): Promise<InventorySyncState[]>;
};
```

`sendMessage` is the only write, and it already exists as a real user action (PIN-0007's
reply box) — today it stores locally and honestly says the customer got nothing. That is
the one place a real integration would visibly change behaviour, so it belongs in the
interface from the start.

Deliberately **out** of the interface until a real integration asks for them: order
fulfilment, label printing, price/stock push, campaign management, payout reconciliation.
Every one is guesswork right now.

### Channel identity in one place
A single resolver keyed by `channels.code`, replacing F1's ternaries and F2's string
sniffing. Unknown codes **throw** rather than defaulting to TikTok — the same rule the
seed already follows for channel spellings.

### A demo adapter
One implementation reading the seeded D1 data, so the interface is exercised by real code
and the sync grid renders real values instead of literals.

## Schema

A `channel_health` table (adapter-owned state) and an `accent` column on `channels` for
the logo class. Both additive, per spec Q4.

`inventory_levels.sync_state` stays as it is for now — normalising it into per-channel
rows is a data-model change that wants its own ticket, and nothing currently reads it as
anything but a label.

## Acceptance criteria (whole spec)

- [ ] One channel resolver; no channel ternary or `startsWith` sniffing left in queries or components.
- [ ] An unknown channel code fails loudly rather than rendering as TikTok.
- [ ] `StockView`'s sync grid renders from `channel_health`, not literals.
- [ ] A demo adapter implements the full interface against seeded data.
- [ ] Every screen renders as it does today.
- [ ] Tests cover the resolver's failure case and the sync grid.
- [ ] `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` pass.

## Questions for เกรพ

1. **Is milestone 3 the right thing now at all?** Milestone 4 (auth) is arguably more
   valuable: adapters need per-shop credentials to be anything more than an interface, so
   auth is the real prerequisite. Doing 3 first means the adapter interface is written
   before we know how credentials arrive.
2. **How far into F3?** The narrow version renders the sync grid from a `channel_health`
   table. The wider one also normalises `inventory_levels.sync_state` into per-channel
   rows — more correct, more churn.
3. **Should the demo adapter be able to fail on purpose?** A "TikTok is down" toggle would
   let the honest error states from PIN-0008 actually be demonstrated to a client, rather
   than only existing in tests.
