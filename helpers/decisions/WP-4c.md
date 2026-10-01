# WP-4c — `chat`, `trip-check`, routine table: decisions

Every default this WP picked, with why. Constants live in the named files; change them there.

## chat
- **C1 · Request check in the driver.** `chat-context.mjs --request --fire-text --state` runs ROUTINE MODE rule 5 deterministically (`checkRequest()`): fire text exactly `req_` + `[A-Za-z0-9_-]{8,64}` (SPEC §2 id rule), file `type: request`, same `id`, kind `message`/`ask`, id present in `state.json` `requests_open`. On any failure it returns at once and reads nothing else (no memory read on behalf of an unverified text). The SKILL.md also tells the routine not to use a malformed fire text in a Drive search at all.
- **C2 · "Already answered" = not in `requests_open`.** The core removes a request from `requests_open` when it is answered or expired (SPEC §3), and `state.json` is rewritten when a request opens, so absence is the duplicate signal. `dedupe_key: chat-<id>` is the second guard (core drops a repeat within 6 h).
- **C3 · Trip resolution** follows `skills/README.md`: explicit `--trip`; else a slug or the full title inside the owner's words; else a destination whose words all appear; else the only trip not `done`; otherwise `ambiguous`/`none` and the reply asks which trip (the one question allowed). Destination matching is the weakest signal, so it is tried only when slug/title found nothing.
- **C4 · Stop numbering is per day, from 1**, in clock order (the order of `DayPlan.stops`). The owner sees days, not a global list; "stop 3" without a date means the date named, else today in the trip, else every day with a third stop.
- **C5 · Itinerary times stay trip-local** and the reply says "local time"; other times use `state.json` `tz`. Converting a 09:35 tram to the owner's home zone would be wrong on the ground.
- **C6 · Legs name the lodging** (`lodging_start` / `lodging_end` → the lodging's name) instead of the planner's `lodging` placeholder.
- **C7 · `chat-check.mjs`** (an extra driver) checks the drafted reply: `text` ≤ 4000 (envelope.mjs checks only the 16 000 string cap; the core's `reply` limit is 4000), payload keys `text`/`html` only, at most one hand-off block, kind in `replan · plan · research · notes · brochure`, only the kinds-table fields (so `allowOverBudget` or any invented field is rejected), trip is in memory, dates inside the trip, place slugs are candidates of that trip, `replan` needs `dates` and an existing build.
- **C8 · Hand-off kinds.** `plan` is allowed besides the brief's `replan/research/notes/brochure`, because "plan it with X and Y" on a trip with no build is a natural chat ask and the kinds table defines it. `prefs` is not: it reads Gmail and Calendar, so the owner starts it explicitly.
- **C9 · Hand-off placement.** One fenced ```json block inside `reply.text`, because a `reply` payload is `{text, html?}` only (SPEC §2) and an extra payload key would be rejected by the core. Phase 5 parses it (status R4).
- **C10 · Web budgets** 10 searches / 20 fetches / 15 min (brief), through the research kit CLI so the budget is enforced and every page is scanned for injection. Chat makes no Maps call: a Text Search costs Pro/Enterprise units for answers the web gives with citations.
- **C11 · Owner statements that sound like lasting preferences** go to `quarantine/<date>-chat-<slug>.md`, not `## Owner notes`: the brief forbids memory edits from chat, and quarantine is where the owner promotes things.
- **C12 · Log line** names the class (a/b/c/d) or the silence reason, never the owner's words (logs are merged into `main` and kept).

## trip-check
- **T1 · Tier `enterprise`, not Essentials.** `node vendor/helpers/kits/maps/index.mjs masks`: Essentials = id, location, address, types, viewport; Pro adds `businessStatus` but no hours; Enterprise is the lowest Place Details tier with `regularOpeningHours`. The plan's "Essentials cost" wording was wrong. Cost: 1 Enterprise unit per distinct place scheduled today or later, per week — about 45 a week for 3 trips × 15 places, ≈ 195 a month, inside the 1,000 free Enterprise requests ($20 per 1,000 beyond; kit ceiling 800 a month, shared with plan and brochure builds). `--tier` accepts only `enterprise` or `enterprise_atmosphere`.
- **T2 · Which trips.** Latest build exists, `status` not `done`, `end_date` ≥ today in the **trip's** zone (the trip ends where it is). Only stops dated today or later are checked; past days cannot be re-planned.
- **T3 · Change codes and order.** `closed_business` (status not OPERATIONAL, from `hoursOn`) wins over hours; then `closed_day` (no window that weekday), `outside_hours` (no window contains `[arrive, depart]`), plus `moved` (> 100 m) independently, and `gone` (Place Details HTTP 404). Unknown hours or "open 24 hours" count as fitting, as in the planner. A window that changed but still contains the stop is not reported.
- **T4 · Baseline for `moved`.** The Plan holds no coordinates (Place schema; Maps terms allow lat/lng ≤ 30 days). Sources, newest first: `--baseline FILE` and the snapshot store itself (`purge()` strips content but keeps locations for 30 days), any record ≤ 30 days old except this check's own build id. Without one the stop counts in `no_baseline` and no move is reported. Routine containers do not keep the store, so live `moved` needs status R2.
- **T5 · 100 m threshold** (brief). Haversine on the WGS84 mean radius; a re-geocode jitter is a few metres.
- **T6 · One notice per run**, every change on its own verb-first line ("Re-plan <date> of <trip> …"; "Check …" for a move, which may be harmless), ≤ 40 lines, ≤ 4000 chars, `level: warn` unless every change is a move, `dedupe_key: trip-check-<local date>`. The notice carries the new opening window because the owner needs it to decide; Google content otherwise stays in the purged store.
- **T7 · Weekly repeats.** An unresolved change is reported again the next week (the rule is "never twice in one day"); a re-plan clears it.
- **T8 · Failures are logged, not sent.** A fetch error, a missing Plan file or `SKU_CEILING` does not produce a notice; next week retries. Exit code 1 covers changes and failures alike; the payload decides.
- **T9 · `--list`** prints the Plan files a check needs (Drive paths from `builds[].drive`) with no Maps call, so the routine downloads exactly those before the live run.
- **T10 · Check build id** `<build_id>-check-<today>` keeps check snapshots apart from build snapshots in the shared store and lets the baseline lookup skip the run's own records.
- **T11 · Lodging is not checked** (stops only); a hotel closure would be a useful later addition at one more unit per lodging with a `place_id`.

## Routine table
- **R1 · Models.** Opus 5.5 · high everywhere (plan §6 default); `trip-research` Fable 5.1 · high for a trip that matters; `chat` Opus 5.5 · medium (short, interactive, latency matters).
- **R2 · `trip-check` schedule** Monday 07:00, `CRON_TZ` = the owner's zone (same value as the core's `TIMEZONE`), so a change is in the owner's chat at the start of the week. No fire name: the core never fires it.
- **R3 · Connectors** follow each skill's Inputs: Drive for all (mailbox); Gmail + Calendar only for `prefs-build`; web search/fetch for `trip-research`, `place-notes`, `chat`.
- **R4 · Environment** lists `MAPS_USAGE_LEDGER` for the Maps-spending routines, `MAPS_SNAPSHOT_STORE` (scratch), `PREFS_REF_SALT` (prefs-build), and states that the proxy injects the Maps key.

## Files and examples
- **F1 · Example scripts** (`skills/trip-check/examples/build-fixture-plan.mjs`, `make-baseline.mjs`, `edit-fixture-plan.mjs`) make the dry run reproducible; each refuses or is harmless outside a scratch tree and is never run by a routine.
- **F2 · JSON examples carry no `Developed by` line**: JSON has no comment syntax (same as the pack fixtures). Example envelopes are real `envelope.mjs` output; their ids and timestamps are illustrations.

Developed by: LightAISolutions
