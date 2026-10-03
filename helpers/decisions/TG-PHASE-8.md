# Phase 8 — decisions (part 1: everything that does not need the trip)

Phase 8 was split by the owner on 2026-10-02 ("do as much as I can do now"): every item that needs no evidence from the pilot trip was built before the trip, as v01.45r and one TourGuide PR. Estimate-accuracy tuning waits for the owner's account of the trip; the open list is in `helpers/status/PHASE-8-RESUME.md`.

## 1 Owner questions (Step 1)

| # | Question | State |
|---|---|---|
| 1 | Japan train estimates | Asked on a decision card (Keep · Tune · Pay; recommended Tune: compare the trip's real rides with the estimates and adjust the rail constants). Building continued on the default, no change. |
| 2 | Google hours, ratings and counts in the brochure | Not re-asked before the trip; the Phase 6 default (yes, with attribution) stands. Ask after the trip with item 1's answer. |
| 3 | `/smart` | Phase 7 choice stands: off by default. |
| 4 | Routine models | Phase 7 choice stands: Opus 5.5 on every routine. |
| 5 | Third-party review sources | Needs the pilot's evidence; after the trip. |
| 6 | Other travellers | Built (§3). How their tastes count was asked on a decision card (Their limits, your lead · Equal say · You only); built on the recommended default. |

## 2 Carried findings (Step 2)

| # | Finding | Outcome |
|---|---|---|
| 1 | Typed numbers reach only the newest round | **Fixed.** A round prefix points the numbers after it at that round: `r1 5`, `round 2: 4 7`, `r2 later 3`; plain numbers stay on the newest round. The choose prompt says so (`12_flow_plan.js`). |
| 2 | App Shortlist shows only the newest round | **Fixed.** `shortlist.get { all: true }` adds `earlier` (every earlier round of the open flow, newest first); the shell shows them under the current round and each tap goes to its own round. Shell v01.02w. |
| 3 | Dates live only in the trip file | **Fixed.** `/dates 2027-05-12 2027-05-14` and `/dates hours 09:30 19:00` store dates on the trip row and hours in Settings; every research, plan and replan request then carries `trip_update { start_date, end_date, day_start, day_end, travelers }` and the private repo's skills write it into `trips/<slug>.md` before they work. No PR to change a date. |
| 4 | `/repick` UX (F20) | **Fixed.** `/repick 2 6 r1 5 later 7` reopens choosing and marks those numbers in the same message; `/repick` alone keeps the old behaviour. |
| 5 | Upload key on the command line (F22) | **Fixed.** `tools/upload.mjs --key-from <saved req_<id>.json>` reads `payload.upload_key` itself (refuses a request-id mismatch, a missing key, bad JSON, and `--key` given as well). The private repo's skills save the request and use it. Caveat: the routine still reads the request file once through the Drive connector, so the key passes through its context once; it no longer appears on command lines, in spawn arguments or in repeated tool calls. |
| 6 | `dietary` in the profile excerpt (F12) | **Fixed.** The excerpt reader moved from the private repo into the pack (`packs/tour-guide/travellers/`); the excerpt schema now requires `dietary` (always present, possibly empty) and documents `avoid`, `diet`, `diet_rule`, `day_rhythm`, `also_like`, `party`. Overrides can add a limit, never lift one. Tests in `pack_tour-guide_travellers.test.js`; the prefs kit README points every helper at this reader. |
| 7 | Visit lengths by activity (F21) | **Fixed.** A booking's own length (`booking.minutes` on the place) always wins and is never scaled by pace or calibration. With no sourced figure, a set activity takes its session length (ceremony 60, class or lesson 150, workshop 120, tasting 60, performance 90) before the category default; matching is on whole words, so "tour" and "classic" do not match. The session lengths are typical values, not sourced; a sourced estimate still leads. |
| 8 | `/smart` (F25, F24) | **Fixed:** the `/smart on` reply says to type questions as plain text without `/ask`, and which questions still go to the routines. **Declined:** stored opening hours in the quick lane — the Maps terms forbid storing Google hours (`TG_GOOGLE_FIELDS`), so hours questions keep going to the routine, which fetches them fresh. **After the trip:** the F24 check that a date-based answer names the right day needs live use. |
| 9 | Japan `rating_offset` (F17) | **After the trip:** needs the owner's kept-versus-skipped evidence. |

## 3 Phase 9 follow-ups (Step 4)

- **Other travellers.** The owner adds people in the app (Home → Travelling with → Add someone; ≤ 8, plain display names), ticks who comes on the current trip, and hands the phone over for the interview: "Who is answering?" on the Interview screen switches between the owner and a companion. A companion's answers go out as a `prefs` request with `payload.person` and build `profile/people/<slug>.md` in the private repo, never the owner's profile. Names and slugs live only in the core's Settings and the private repo; the public pack holds none. The interview runs on the owner's phone because the app opens only for the owner (`initData` must carry the owner's id); companions do not need Telegram.
- **How companions count** (default, card open): their limits, your lead — every traveller's dietary limits and things to avoid bind, the strictest diet applies, the pace is the most relaxed anyone gave, the owner's interests lead, and companions' strong interests the owner did not rate are offered as `also_like`.
- **Masthead.** `home` carries the pack's `display_name`; the shell titles itself from it.
- **Route lock.** `registerRoute({ lock: true | function (req) })`: the router takes the script lock after authentication and the daily cap, waits up to `LIMITS.ROUTE_LOCK_WAIT_MS` (10 s), answers `503 busy` when it cannot, and always releases it. A predicate that throws locks. The app route now declares `lock: tgAppNeedsLock` (writes and note requests) instead of taking the lock itself.
- **Formula escaping.** `core/03_store.js` writes any text starting with `=` `+` `-` `@` tab, CR or an apostrophe with a leading apostrophe, so Sheets stores it as text; reads come back unchanged. An update rewrites the whole row escaped, because unescaped reads of untouched cells would otherwise go back as formulas. The Sheet mock now models the apostrophe and records formula writes.
- `prompts/TG-PHASE-9.md` is marked done.

## 4 Smaller defaults

- The module is `packs/tour-guide/travellers/`, not `profile/`: the boundary check treats `profile*` file names in the public tree as personal data.
- `/dates` takes one date for a one-day trip and refuses spans over the plan limit; nothing is saved on a refusal.
- An empty "who comes" list is kept, so the next request clears the trip file's travellers.

## 5 Transit first, trains over buses (owner request, 2026-10-03)

The owner will not have a car and wants transit for anything too far to walk, with train and metro ahead of buses, especially in Japan.

- **Transit is already the default.** New trips start with `modes.default` TRANSIT (allowed TRANSIT and WALK); the planner never switches a TRANSIT day to driving. No change.
- **Rail first.** On a TRANSIT day the planner sends `allowedTravelModes` TRAIN, SUBWAY, LIGHT_RAIL, RAIL unless the trip lists its own. `withBusFallback` re-asks with buses allowed only for the pairs that got no rail route; it decides once per build whether Google has transit at all (a rail route in the answer, or one probe element) and never re-asks where it has none. A trip that wants buses on equal terms lists `BUS` in `transit_preferences.allowedTravelModes`. The budget estimate does not count the re-asks.
- **Japan.** Google returns no transit there, so every TRANSIT leg is a station-based train estimate, which never uses buses. The Maps link still opens Google's own transit options, which may list a bus first; the Maps URL format has no way to ask for trains only.
- **Train estimates checked against the owner's screenshots.** Three real Google transit times from the owner's lodging (32, 37 and 61 min) against the estimates: 2 min over, 3 min under, 7 min under (the long cross-city ride needs two changes). The 2026-10-01 Tokyo check ran 0–10 min over. With errors on both sides the ride constants stay. The station search radius goes from 1 km to 1.3 km: Google's own best routes from that lodging walk 14–19 minutes to the station, and a lodging with no station inside the old 1 km would have fallen back to the plain distance estimate. The decision card (Keep · Tune · Pay) is still the owner's to answer; this is evidence for it, not the answer.

Developed by: LightAISolutions
