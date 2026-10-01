# WP-5b — Envelope handlers, sheets, snapshot: status

**State: in progress (paused by the usage limit before any code was written).**

storage API: not started

## Where I stopped
- Orientation done: read the Phase 5 prompt, the contract (`helpers/decisions/TG-PHASE-5.md` §1), the core (`02_registry`, `03_store`, `05_telegram`, `09_mailbox`, `10_router`, `12_wake`, `15_flows`), `gas/00_common.js`, the six payload schemas and `schemas/tour-guide-checks.mjs`, the prefs kit decisions reader (`kits/prefs/lib/decisions.mjs`), the mock harness, and the brain's example payloads (`TourGuide` `skills/trip-research/examples/`). Baseline checks green (303 pass, 1 skipped; bundle and boundary-check clean).
- No file of this WP exists yet.

## Next step
1. Write `helpers/packs/tour-guide/gas/21_sheets.js` (registerSheet for Trips, DayPlans (+ a `part` column for cells over 50 000 chars), Later, Places, Choices, Shortlist; the §1.3 storage API) and `helpers/tests/pack_tour-guide_gas_sheets.test.js`; commit; set "storage API: done" here.
2. Then `gas/20_envelopes.js` (six handlers with hand-written validators mirroring the schemas + semantic checks, `pf` callback, `tg_0pf_edit` message handler, snapshot provider `tour_guide`) and `pack_tour-guide_gas_envelopes.test.js`; `helpers/decisions/WP-5b.md`.

## Requests to other owners
None yet.

Developed by: LightAISolutions
