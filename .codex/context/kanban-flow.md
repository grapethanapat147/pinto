# Kanban Flow — Pinto (PIN)

Ticket-first workflow, mirroring the convention used in the ICW, Famai and Longsanam projects.

This board is **local to this repo**. Pinto tickets are `PIN-XXXX` and have nothing to do
with ICW's `INF-XXXX` board — do not create Pinto tickets there.

## Board files
- `.codex/tasks/backlog.md`
- `.codex/tasks/in-progress.md`
- `.codex/tasks/review.md`
- `.codex/tasks/done.md`

## Ticket files
`.codex/tasks/tickets/PIN-XXXX.md` — one file per ticket, 4-digit zero-padded.

## States
`Backlog -> In Progress -> Review -> Done`

## Rules
1. Every code change belongs to exactly one open ticket.
2. A ticket moves to **Review** only when its acceptance criteria are all met and its tests pass.
3. A ticket moves to **Done** only after review notes are appended to the ticket file.
4. Next ticket number:
   `find .codex/tasks/tickets -maxdepth 1 -type f -name 'PIN-[0-9][0-9][0-9][0-9].md' -exec basename {} .md \; | sed 's/^PIN-//' | sort -n | tail -1`
5. Branch naming: `feature/PIN-XXXX` or `bugfix/PIN-XXXX`.

## Definition of Done
Inherits `CLAUDE.md`'s definition of done, plus:
- Acceptance criteria satisfied.
- `npm run build`, `npm run lint` and `npm test` all pass.
- Desktop (1440), compact (1024), mobile-nav (760) and phone (390) layouts stay readable.
- Empty, loading, error and success states covered for anything newly asynchronous.
- **No simulated success.** A toast may not claim an operation succeeded unless the
  backend confirmed it. Controls that do not yet perform real work must say so.
