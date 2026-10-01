# WP-5b — Envelope handlers, sheets, snapshot: status

**State: in progress.**

storage API: done

## Built
- `helpers/packs/tour-guide/gas/21_sheets.js` — the six tabs (`Trips`, `DayPlans` (+ `part`), `Later`, `Places`, `Choices`, `Shortlist`) and the full storage API of contract §1.3: `tgTripGet/List/Upsert/Current/SetStatus`, `tgDigestStore/Days/Day`, `tgLaterList/Add`, `tgPlacesUpsert/Search/Get/Counts`, `tgChoiceSet/List/Clear`, `tgProfileSummaryGet` (+ `tgProfileSummaryStore`), `tgShortlistStore/Items` (+ `tgShortlistRunKey`, `tgShortlistLatest`); snapshot provider `tour_guide`.
- `helpers/tests/pack_tour-guide_gas_sheets.test.js` — 11 tests.

## For WP-5a / WP-5c (merge `wp-5b` now)
- Shortlist buttons: use `tgShortlistStore(p).run` (or `tgShortlistRunKey(trip, p.run_id)`) as `<run>` in `sl:<run>:<n>:…`; `tgShortlistItems(trip, run)` accepts the short key or the full `run_id`. Item numbers are unique across a round's groups (the brain numbers food on from activities).
- Shortlist taps for the snapshot's counts: `tgChoiceSet(trip, run, 'shortlist', n, 'w' | 'l' | 's')` (any value starting with w / l / s counts).
- `tgDigestStore` sets the trip `planned` (never regresses `done`); the flow sets `delivered`.

## Next
- `gas/20_envelopes.js` (six handlers, `pf` callback, `tg_capture_pf_edit`) and `pack_tour-guide_gas_envelopes.test.js`.

## Requests to other owners
None.

Developed by: LightAISolutions
