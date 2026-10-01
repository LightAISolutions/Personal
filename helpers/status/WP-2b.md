# WP-2b — Research kit: status

**State: done** — ready for the coordinator to merge `wp-2b`. Branch never pushed.

## What landed

- `helpers/kits/research/` — `index.mjs` (CLI entry + library exports), `lib/` (budget, ledger, claims, injection,
  sanitize, domain, duration, schema, run, session, cli), `schemas/research-run.schema.json`, `fixtures/`
  (invented city "Velmora", reserved domains only), `README.md` (the contract, written as routine instructions).
- `helpers/tests/kit_research_core.test.js` (19), `kit_research_injection.test.js` (9), `kit_research_cli.test.js` (5)
  — 33 tests, no network, ~3 s (the CLI suite spawns the real entry point).

## Contract checklist

| Item | Done |
|---|---|
| Per-run budgets (searches, fetches, wall time) enforced by the kit; caps | yes — library refuses before calling; CLI refuses with exit 3 |
| Source ledger schema (URL, fetched date, what it supported) | yes — `ledger[]` with `supports` / `contradicts` back-links |
| Two-source rule for hours, closed days, durations, tickets, prices | yes — `plan_ready` needs `confirmed` for critical kinds |
| Independence = different publishers; mirrors and syndicated copies merged | yes — publisher key, canonical, derived-from, text similarity |
| Confidence labels with exact rules incl. source age | yes — README §Claims and labels, decisions #12–16 |
| Injection: flagged with reasons, never `confirmed`, no effect on budgets / fields / outputs | yes — tested with 5 hostile fixture pages and a hostile fetcher |
| Sanitizer for stored excerpts | yes — `sanitizeText` / `sanitizeLine` |
| Visit-duration helper (mentions → range + confidence) | yes — `durationRange`, `duration` command |
| JSON Schema for the run file | yes — validated on every load/save |
| Library (injected search/fetch) and CLI | yes |
| No live web calls; invented fixtures on reserved domains | yes |

Not done (out of scope): automatic extraction of facts or durations from page text — the routine reads the page and
states the claim / mention; the kit verifies, labels and audits.

## Checks (run in this worktree)

- `node --test helpers/tests/` — 87 tests, 87 pass
- `node helpers/tools/bundle.mjs --all --check` — ok
- `node helpers/tools/boundary-check.mjs` — clean
- Duplicate basenames: only `README.md` (kit README, allowed) and `WP-2b.md` (status + decisions, the names the
  brief prescribes — same pattern as the existing `TG-PHASE-1.md` pair)

## Requests for the coordinator

1. **SPEC §16 kit layout** (`helpers/SPEC.md`, the `index.mjs` line): the CLI form must be
   `node helpers/kits/<kit>/index.mjs <command>` (and `node vendor/helpers/kits/<kit>/index.mjs` in a private repo);
   `node helpers/kits/<kit>/` fails with MODULE_NOT_FOUND. Already acknowledged by the coordinator; no further patch.
2. None for `core/` or `tools/`.

## How to run

```
node --test helpers/tests/kit_research_*.test.js
node helpers/kits/research/index.mjs help
```

Developed by: LightAISolutions
