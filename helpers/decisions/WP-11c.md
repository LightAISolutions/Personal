# WP-11c — decisions and assumptions (C11 storage and display, plans in parts, /dates per day)

Brief: `helpers/prompts/TG-PHASE-11.md` row WP-11c and Contract C11. State and checks: `helpers/status/WP-11c.md`.

## Process
1. **Ownership.** Only WP-11c paths are edited. `checkTrip` and `checkPlace` in `schemas/tour-guide-checks.mjs` belong to WP-11b and are untouched. Anything else goes to the status file as a REQUEST.
2. **Fixtures are invented** (invented towns, invented dates in 2027). No network call, no package install.

## Validators
3. **`later` only in part 1.** Both validators reject a non-empty `later` in a part above 1. The brief says the other parts send `[]`; rejecting early keeps a later part from silently losing its list.
4. **`part` and `parts` go together.** One without the other is rejected in both validators; `part > parts` is rejected.
5. **Times** (`sunset`, `last_entry`, anchor/dinner/extra times) use the existing `HH:MM` 00:00–23:59 rule; `menu_checked` uses the existing date rule.

## Storage
6. **Day fields in `meta_json`.** `meta_json` is now written in 45 000-character parts like the other JSON columns (a dinner plus three extras with note lines can pass one cell on a long day only in theory, but chunking costs nothing). Old rows, whose meta sits whole in part 0, join and load unchanged.
7. **Returned only when present.** `tgDigestDays` adds a C11 day key only when the stored day carried it, so an old day's object is exactly as before.
8. **`menu_checked` must be a real date in Node too.** The schema pattern let `2027-02-30` through; `checkPlanDigest` now refuses it, as the GAS validator already did. The check sits in `checkPlanDigest` (line 285+), clear of WP-11b's lines.

## Plans in parts (`gas/23_plan_parts.js`)
9. **A staging tab, `DigestParts`.** Columns `trip, build_id, part, parts, chunk, json, top, env_id, in_reply_to, received_at`. One row per 45 000-character chunk of a part's `days` JSON. A sheet survives restarts, needs no new property and is visible to the owner, which a cache would not be.
10. **Same top fields in every part.** `trip, build_id, verified_on, tz, drive, parts` are compared as fixed-order JSON. A part whose top differs from the parts already staged drops the whole build (owner notice), because the parts cannot be one plan.
11. **Re-sending is safe.** A part re-sent while its build is still arriving replaces its own rows and keeps the build's first-arrival time. A part of a build that is already stored is a `duplicate` (audited, nothing changes). Order does not matter: the plan is joined when every part from 1 to `parts` is present.
12. **The joined plan is checked again.** Days are joined in part order, and the checks only the whole plan can fail run on them: dates in order with none repeated, and at most `TG_PARTS.MAX_DAYS` (31) days. Each part already passed the validator, size cap included. A failure drops the build with the owner notice.
13. **`in_reply_to` of the joined plan** is part 1's, else the first non-empty one in part order, so a `/replan` reply still threads to its request.
14. **A newer build replaces an older one.** A part (or a whole plan) for the same trip with a different `build_id` deletes the older build's staged rows silently. The newer plan is what the owner asked for last.
15. **24 hours to arrive.** The `tg_digest_parts` alarm fires 24 h (`TG_PARTS.TTL_MS`) after the earliest first-received part. A build still incomplete then is dropped with one notice: "⚠️ <b>Trip</b>: a plan arrived incomplete; /replan tries again." Dropped builds are remembered (the last 20, setting `tg_digest_dropped`) so a straggling part does not restart them.
16. **A missing tab is created, not a crash.** If `DigestParts` is missing (an install that has not re-run setup), the first part runs `ensureSheets()` before staging (tested).

## Display
17. **Day-card order.** Start line at the top, then the stops. Each stop line ends with `· last entry HH:MM` when known, followed by its `🎟` booking line and `👥` crowd note. After the lodging leg come the dinner lines, the day-end leg and `🏁 Ends …`. Before the walk notice come "If you have energy" (✨ event, 🔖 saved) and `🌅 Sunset`. Every field is optional; an old day renders byte-for-byte as before (tested).
18. **Crowd words.** `opening` → "Go at opening; it gets busy later"; `late` → "Late is quieter".
19. **Links only Google Maps https.** Stop and anchor links reach the card and the app only through the existing `tgCmdHref` / `tgAppMaps` filters, so a non-Maps link a digest carries is not shown.
20. **"local favourite"** joins the shortlist line's bits right after the area, only when `local_favourite === true`. The app's round items carry `local_favourite: true/false`.
21. **App `trip.digest`** returns the C11 day and stop keys only when present, matching item 7.

## `/dates` per day
22. **Form.** `/dates <YYYY-MM-DD> start <place> <HH:MM>`, `end <place> <HH:MM>`, `hours <HH:MM>-<HH:MM>`, `bags <hotel|locker|forward|carry> [note]`, `clear`. The place is everything before the trailing time.
23. **Refusals.** Each gets its own one-line reason ending "Nothing was saved.": not a real date; the trip has no dates; the date is outside the trip; no place or no time; a place or note over 120 characters; an unknown bags word; a day shorter than 2 hours (span from the day's own start/end, else its hours, else the trip's hours). Place and note text is stripped of hidden characters and escaped in replies. The `/dates` help still starts "Change them with".
24. **Storage.** One setting, `tg_trip_days`, holds `{ <trip slug>: { <date>: { start?: {text, time}, end?: {text, time}, day_start?, day_end?, bags?, bags_note? } } }`. `clear` removes one date and keeps the trip key, so `trip_update` still reports `day_overrides: {}` and the brain knows they were cleared.
25. **`trip_update.day_overrides`** is sent whenever the trip has a key in the setting, so the next plan or `/replan` uses it. Replies name the weekday and date in the trip's words ("Thu 10 Jun").
26. **`/dates` with no argument** also lists each day's settings under the trip line.

## Docs
27. **`helper.json` unchanged.** No new envelope type (parts are still `plan_digest`) and no new scope or property, so the manifest has nothing to list.
28. **WP-11b doc entries** (coordinator relay): the pack README gained `facts/` and `season/` rows and sections, the `out_of_season` drop and the two screen flags; SPEC §16 gained the WP-11b rows. Wording follows WP-11b's own READMEs, read from its branch without merging.

Developed by: LightAISolutions
