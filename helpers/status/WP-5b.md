# WP-5b — Envelope handlers, sheets, snapshot: status

**State: done.**

storage API: done

## Built
- `helpers/packs/tour-guide/gas/21_sheets.js` — the six tabs (`Trips`, `DayPlans` (+ `part`), `Later`, `Places`, `Choices`, `Shortlist`) and the full storage API of contract §1.3: `tgTripGet/List/Upsert/Current/SetStatus`, `tgDigestStore/Days/Day`, `tgLaterList/Add`, `tgPlacesUpsert/Search/Get/Counts`, `tgChoiceSet/List/Clear`, `tgProfileSummaryGet` (+ `tgProfileSummaryStore`), `tgShortlistStore/Items` (+ `tgShortlistRunKey`, `tgShortlistLatest`); snapshot provider `tour_guide`.
- `helpers/packs/tour-guide/gas/20_envelopes.js` — handlers for shortlist, trip_facts, plan_digest, profile_summary, prefs_review, places_digest (hand-written validators mirroring the schemas; Google fields refused); store → `plan` flow (same trip) → renderer `tg_<type>` → plain line; `pf` callback + `tg_capture_pf_edit` message handler; decided batch → `tgOpenKindRequest('prefs', { decisions })`; places check / list / unsolicited lines.
- Tests: `pack_tour-guide_gas_sheets.test.js` (11), `pack_tour-guide_gas_envelopes.test.js` (11). Full suite: 328 tests, 327 pass, 1 skipped (the pre-existing live maps smoke), 0 fail. `bundle.mjs --all --check` ok; `boundary-check` clean.

## For WP-5a / WP-5c
- Shortlist buttons: use `tgShortlistStore(p).run` (or `tgShortlistRunKey(trip, p.run_id)`) as `<run>` in `sl:<run>:<n>:…`; `tgShortlistItems(trip, run)` accepts the short key or the full `run_id`. Item numbers are unique across a round's groups.
- Shortlist taps for the snapshot's counts: `tgChoiceSet(trip, run, 'shortlist', n, 'w' | 'l' | 's')`.
- `tgDigestStore` sets the trip `planned` (never regresses `done`); the flow sets `delivered`.
- The `plan` flow receives stored envelopes as `{ type: 'resume', event: 'shortlist' | 'trip_facts' | 'plan_digest', payload, env_id, in_reply_to }` when `flowActive(owner).state.trip` equals the payload's trip. Renderers `tg_shortlist` / `tg_trip_facts` / `tg_plan_digest` may return an HTML string or `{ messages: [{ html, keyboard? }] }`.
- Tests install fakes for the plan flow and renderers by direct `HB_REGISTRY` assignment, so they keep passing once 5a's real ones are merged.

## Requests to other owners
- **R1 (coordinator — `helpers/tests/pack_tour-guide_payloads.test.js`)**: committed separately as `224c568` for approval or revert. With the pack now registering its six envelope handlers, the test's `ctx.registerEnvelopeHandler(t, …)` threw "duplicate". Patch (one line): `if (!ctx.getEnvelopeHandler(t)) ctx.registerEnvelopeHandler(t, { validate: () => [], handle: () => 'ok' });` — the test then validates the six schema examples (including the prefs kit's real review) through the pack's own validators, and passes.

Developed by: LightAISolutions
