# Phase 10 decisions — usefulness pass, step 1 (the right day abroad, honest travel legs, a planner tidy-up, booking deadlines)

*Started 2026-10-03 (coordinator Opus 5.5; builders `hb-builder-opus`, Opus 5.5 · high; no Fable, owner's rule). Prompt: `helpers/prompts/TG-PHASE-10.md`. Generic facts only — no ids, URLs, secrets, trip or place data of the owner's.*

## 1 Work-package decisions
- WP-10a: `helpers/decisions/WP-10a.md` — each trip's own zone (`Trips.tz`, `tgTripToday`, `tgOwnerTz`), Contract C10 acceptance, the `bookings` envelope and Bookings tab, the core alarm (`core/17_alarms.js`). State and checks: `helpers/status/WP-10a.md`.
- WP-10b: `helpers/decisions/WP-10b.md` — honest travel legs, the tidy-up fixes (a)–(f), the day card and brochure display, Google's walking notice. State and checks: `helpers/status/WP-10b.md`.

## 2 Merge choices (coordinator)
1. Both work packages ran in their own worktrees and were squash-merged, 10a then 10b, onto the session branch cut from `origin/main`; no textual conflict.
2. **`tgBkDayLines(trip, day)` takes the stored day or its date.** WP-10b's day card passes the stored day object; WP-10a compared a date string, so the card would have shown no booking line. Found by the end-to-end test; a test covers each form.
3. **REQUEST 10b-1 applied:** `checkDayPlan` lets a WALK leg be `estimated` (a failed WALK request keeps the distance estimate) — "only a TRANSIT or WALK leg can be estimated", `estimated` and `estimate_basis` together, one `transit_estimated` warning per day. One transit-fallback test pinned the old message; its pattern was updated.
4. **REQUEST 10b-2 applied:** `checkDayPlan` refuses a repeated leg flag ("duplicate flag"), as `checkPlanDigest` already did.
5. **REQUEST 10a (brochure) applied:** `toBrochureModel` puts the Bookings section **first** on the practical page (`options.owner_tz`, `options.now`), so the section cap never cuts it; deadlines are what that page is opened for before a trip.
6. **REQUEST 10a (notice) kept:** `tools_envelope.test.js` expects `bookings` among the pack's envelope types.
7. **Walking notice accepted as built:** Google requires it on every walking route shown, so an older day with a walk leg now shows it too (WP-10b decisions 27 and 29).
8. **Reminder cadence as approved:** a booking still to book gets the 09:00 daily reminder while its window is open, until Booked or Not needed ("once a day until you tap Booked"); Tomorrow snoozes one day.
9. End-to-end test `pack_tour-guide_phase10_e2e.test.js`: a C10 digest through the mailbox to the day card abroad on the trip's own day; a `bookings` envelope into `/trip` (both times), the day card, a reminder, and silence after Booked; the brochure's Bookings page.

## 3 Checks
`node --test helpers/tests/`: 610 tests, 609 pass, 1 skipped (the live Maps smoke, by hand only). `bundle.mjs --all --check` and `boundary-check.mjs` clean.

## 4 Private repo (WP-10c)
*Filled after the re-pin: what the PR maps, the seeded bookings, the dry runs.*

## 5 Live check
*Filled after the owner merges the private-repo PR.*

## 6 Carried to Phase 11
1. **A booking with no day** is reminded but shows on no day card; the whole-trip outline gives every booking a day.
2. **Reminders follow the home zone until a trip is in progress** (start ≤ today ≤ end in the trip's zone). A trip record that covers only part of the travel gets 09:00 home-time reminders on the travel days before it; the outline makes the whole journey one record.
3. **A lodging change does not re-plan finished days**: a planned day keeps its legs from the old lodging until `/replan`. The outline re-plans the affected days.

Developed by: LightAISolutions
