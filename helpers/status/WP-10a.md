# WP-10a — trip time zone, Contract C10 acceptance, bookings and reminders, core alarm registry

**State: done.** Branch `wp-10a` (6 commits on top of `33e67ae`). `node --test helpers/tests/` 574 pass / 0 fail;
`node helpers/tools/bundle.mjs --all --check` ok; `node helpers/tools/boundary-check.mjs` clean.
Assumptions and defaults: `helpers/decisions/WP-10a.md`.

## Done
- **Core alarm registry** — `registerAlarm(name, { next(nowMs), run(nowMs) })` (02_registry.js), `17_alarms.js` (`alarmArm`, `alarmPending`, `alarmTrigger`, `alarmNextAll`), `alarmTrigger` in `ONE_OFF_HANDLERS`, daily backstop in `wakeSweep`, `LIMITS.ALARM_*`; zone helpers `isoDateIn`, `isValidTz`, `isoDateAdd`, `msAtLocal` (01_util.js). Tests: `core_alarm.test.js` (6).
- **Each trip's own day (suggestion 1)** — `Trips.tz`, `tgTripTz`, `tgTripToday`, `tgTripSetTz`, `tgTripAway`, `tgOwnerTz` (21_sheets.js); `/today` header "📍 Today in …" when away; `/replan today|tomorrow` in the trip's day; review and chat API dates. Tests: `pack_tour-guide_gas_trip_tz.test.js` (9).
- **Contract C10** — schema (`tour-guide-plan-digest`, `tour-guide-trip`), checks, GAS validator, `DayPlans.meta_json` (part 0), `tgDigestDays` returns the C10 stop/leg fields and `spare_minutes` (number or null), digest `tz` sets the trip zone.
- **Bookings (suggestion 6)** — schemas `tour-guide-booking` / `tour-guide-bookings`, `helper.json` envelope type `bookings`, GAS validator + handler (20_envelopes.js), `gas/14_bookings.js` (Bookings tab created on first use, replace semantics with owner taps winning, `/trip` lines via one call in `tgCmdTripMessages`, `/bookings`, `/bookings now`, `tgBkDayLines`, alarm `tg_bookings` with the opening alert and the 09:00 reminder, `bk` buttons edited in place, `tour_guide.bookings` snapshot). Tests: `pack_tour-guide_gas_bookings.test.js` (14).
- **Brochure** — `brochure-map/brochure-map-bookings.mjs` `bookingsSection(bookings, { tripTz, ownerTz, now })`. Tests: `pack_tour-guide_brochure-map_bookings.test.js` (3).
- **Docs** — SPEC §5 (registerAlarm row + core helpers), §9 (alarmTrigger row), §16 (WP-10a row), §18 (ALARM limits); pack README.
- Harness: `tgUpdate({ callback, messageText?, replyMarkup? })` for in-place redraw tests.

## REQUESTs
- **REQUEST (notice, already applied):** `helpers/tests/tools_envelope.test.js` line 17 — added `'bookings'` to the expected `typesFor('tour-guide')` list. Not a WP-10a path, but the new envelope type made the existing assertion fail; the one-word edit is in commit `5021516`. Coordinator: keep or redo it at merge.
- **REQUEST:** wire `bookingsSection` into `brochure-map/index.mjs` `toBrochureModel` (push `bookingsSection(trip.bookings, { tripTz: trip.timezone, ownerTz, now })` onto `practical` when non-null) — `index.mjs` is not a WP-10a path. WP-10b owns the brochure display; whoever owns `index.mjs` at merge.
- **REQUEST (WP-10b):** the day card may call `tgBkDayLines(trip, day)` behind `typeof tgBkDayLines === 'function'`; it returns already-escaped lines.
- **REQUEST (WP-10c / private repo):** a `bookings` producer skill (routine) that writes the trip's full list with `node vendor/helpers/tools/envelope.mjs bookings <skill> <payload.json> --pack tour-guide`, and the digest builder mapping of the C10 fields.

Developed by: LightAISolutions
