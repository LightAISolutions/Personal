# WP-3d — Tour Guide engine: choices, statuses, payload schemas, manifest: status

**State: done** (2026-10-01). Branch `wp-3d`, worktree `../wt-4b-3d` (from `c17cd68`, v01.19r), never pushed. Defaults and reasons: `helpers/decisions/WP-3d.md`. The same builder also did **WP-3e** (transit fallback) in this worktree: `helpers/status/WP-3e.md`.

## Contract (TG-PHASE-4 row 3d + the coordinator's two scope messages)
| Item | State |
|---|---|
| `planTrip(input)` takes `input.choices = { picks, later, skip }` by slug | done — `planner/planner-choices.mjs` + `planner/index.mjs` |
| picks = the whole pool, status `chosen`; others stay `candidate` and are not planned | done — unpicked candidates are in no Later list (the plan check allows it only when `plan.choices` is present) |
| later → "Saved by you" Later list, code `owner_choice` | done — status saved-for-later; reason "you kept this for later when choosing from the shortlist" |
| skip → rejected | done — status rejected, never planned, in no list |
| No choices → output unchanged | done — byte-identical to `c17cd68` on both fixtures (hashes below); `pack_tour-guide_choices` checks absent / `null` / `{}` give the same plan |
| `replanDays` respects choices | done — explicit `input.choices`, else the recorded `plan.choices`; `choices: null` drops them; other days stay byte-identical |
| trip.status enum intake · researched · choosing · planned · delivered · done | done — plus legacy `draft` until the fixtures move (request 1) |
| place.status gains `chosen` | done — schema, `later/` PLACE_STATUSES, planner pool |
| Place gem fields: gem_score, gem, obscurity, local_mentions, flags | done — `tour-guide-place.schema.json` |
| Place v01.16r fields: destination, history[], last_researched, last_verified | done — schema + checks (real dates, history oldest first) |
| LaterList codes `owner_choice`, `not_shown` | done — lists "Saved by you" and "Gems not chosen" (`defaultListFor`, `LIST_DESCRIPTIONS`) |
| Six payload schemas: shortlist, trip_facts, plan_digest, profile_summary, prefs_review, places_digest | done — `schemas/tour-guide-{shortlist,trip-facts,plan-digest,profile-summary,prefs-review,places-digest}.schema.json` + semantic checks |
| shortlist item `seen_before?`, `changes?`, `dims?` | done |
| places_digest has no Google fields, ≤ 60 000 chars | done — strict schema (hours, rating, address, website, business_status, user_rating_count refused) + size check |
| prefs_review = the prefs kit's real output | done — test builds a real review with the kit (`ingest` + `buildReview`, also `includeSuspect`) and validates it |
| `PAYLOAD_KINDS` + `validatePayload(type, payload)` in `schemas/index.mjs` | done |
| `helper.json`: `envelope_types` = the six, `action_allowlist` empty | done |
| `envelope.mjs --pack tour-guide` validates the payload with the pack's schemas | done — `packPayloadErrors(pack, type, payload)`; the tool stays generic (any pack with `schemas/index.mjs` exporting `validatePayload`) |
| Core mocks accept the six types | done — `registerEnvelopeHandler` + `validateEnvelope` for each, in `pack_tour-guide_payloads` |
| README: "Payloads (envelope types)" + choices contract | done — pack README |
| Sibling request WP-2f: `profile_summary` payload is `{ text ≤ 1200 }` | done — only `text` required (plain text, may hold newlines); `dimensions_count`, `updated`, `v`, `kind` stay optional (decision 18) |
| Sibling request WP-2g-engine: LaterList `not_shown`; Place `gem_score` (number 0–100), `gem`, `obscurity`, `local_mentions`, `flags`; shortlist item `gem`, `gem_line` ≤ 200 | done — spelled exactly as in `helpers/status/WP-2g-engine.md` request 1 (`gem_score` is a number there, so a number here). Checked in a scratch copy: the gems test with its `TODO(WP-3d)` lines replaced by `assert.deepEqual(s.validate(list, 'later-list').errors, [])` passes 11/11 on these schemas; `LATER_CODES` has `not_shown` too |
| Tests | done — new `pack_tour-guide_choices` (5), `pack_tour-guide_payloads` (6); extended `pack_tour-guide_schemas` (11), `pack_tour-guide_later` (6), `tools_envelope` (4) |

## Byte-identical without choices
`JSON.stringify` sha256 (first 16 hex) of `planTrip` and of `replanDays(plan, [day 2])` on each fixture, seed 7, `now` 2027-04-30T09:00:00Z — identical on `c17cd68` and on this branch (after WP-3e too):
- transit-city: plan `58aeef0de0249ae7`, replan `df35eaf97317a43e`
- driving-loop: plan `a0393b72c2b892b2`, replan `5bff4a53da7245e4`
Not pinned in a test (any later planner change would break it for no reason); the choices test compares choice-less runs to each other instead.

## Checks
Run from `/home/user/wt-4b-3d` at the last commit (WP-3d + WP-3e + the sibling schema requests):
- `node --test helpers/tests/` →
  ```
  # tests 249
  # pass 248
  # fail 0
  # skipped 1
  ```
  The skip is the Maps kit's by-hand live smoke. Base `c17cd68` had 227 tests (226 pass, 1 skip).
- `node helpers/tools/bundle.mjs --all --check` →
  ```
  ok: hello — 16 files, 99311 chars, 4 scopes
  ok: tour-guide — 15 files, 97858 chars, 4 scopes
  ```
- `node helpers/tools/boundary-check.mjs` → `boundary-check: clean — 279 file(s) under /home/user/wt-4b-3d/helpers`

## Found and fixed on the way
- **The test suite is one process.** `helpers/tests/index.js` `require`s every `*.test.js`, so harness state is shared across files. The harness's `envelope()` reads the clock of the most recent `loadGas()`. A first draft of `pack_tour-guide_payloads` pinned that clock to 2027, and `tools_bundle`'s end-to-end test (which builds its own mocks on the real clock) then had its greeting refused as "created_at is in the future". Fixed in the payloads test (real clock on both sides, with a comment). Worth knowing for every later test that sets `__TEST_NOW`: see request 3.

## Requests to the coordinator (files WP-3d does not own)
1. **Fixtures: trip status `draft` → `intake`.** `fixtures/transit-city/tg-fixture-transit-city-trip.json` and `fixtures/driving-loop/tg-fixture-driving-loop-trip.json` (`"status": "draft"`), and `helpers/tests/pack_tour-guide_planner_world.js` line 80 (`status: 'draft'`). Then drop `"draft"` from the enum in `schemas/tour-guide-trip.schema.json` (one word; its description already says so).
2. **Bookkeeping** (push time): CHANGELOG, README tree, `helpers/BUILD-STATE.md`. New files:
   - `helpers/packs/tour-guide/planner/planner-choices.mjs`
   - `helpers/packs/tour-guide/schemas/tour-guide-{shortlist,trip-facts,plan-digest,profile-summary,prefs-review,places-digest}.schema.json`
   - `helpers/tests/pack_tour-guide_{choices,payloads}.test.js`
   - `helpers/status/WP-3d.md`, `helpers/decisions/WP-3d.md`
   - (WP-3e's files are listed in `helpers/status/WP-3e.md`.)
3. **Harness (optional, `helpers/tests/harness/gas-mocks.js`, not owned):** `envelope()` defaults its `created_at` to the last `loadGas()` clock even when the caller built its mocks with `createMocks()`. Resetting `_last` in `createMocks()` (or passing `state` to `envelope()`) would stop one file's pinned clock leaking into another.
4. **WP-2g-engine follow-up (its test, not owned here)**: in `helpers/tests/pack_tour-guide_gems.test.js`, test "gemsNotChosenList…", replace the `// TODO(WP-3d)` comment and the three lines after it (`const r …`, `const otherErrors …`, `assert.deepEqual(otherErrors, …)`) with `assert.deepEqual(s.validate(list, 'later-list').errors, []);` once both branches are merged.

## For the private repo (WP-4d)
```js
// planner
planTrip({ trip, places, snapshots, estimates, notes?, profile, calibration?, maps, build_id, now, seed?, chooseMinutes?,
           choices?: { picks?: string[], later?: string[], skip?: string[] } }) → Plan   // plan.choices = { picks, later, skip } (sorted) only when choices were given
replanDays(plan, dates, input) → Plan   // input.choices given → used (explicit); absent → plan.choices; null → dropped
estimateBudget(input) → budget          // honours choices
// payloads
import { PAYLOAD_KINDS, validatePayload } from 'vendor/helpers/packs/tour-guide/schemas/index.mjs';
PAYLOAD_KINDS = { prefs_review: 'prefs-review', shortlist: 'shortlist', trip_facts: 'trip-facts', plan_digest: 'plan-digest', profile_summary: 'profile-summary', places_digest: 'places-digest' }
validatePayload(type, payload) → { ok, kind, errors: [{ path, message }] }   // unknown type → { ok: false, kind: null, errors: [...] }
// tool
node vendor/helpers/tools/envelope.mjs <type> <skill> <payload.json> --pack tour-guide   // refuses a payload that fails validatePayload
packPayloadErrors(pack, type, payload) → Promise<string[]>   // 'payload/<path>: <message>'; [] for core types or packs without schemas
```
Errors from `planTrip` on bad choices start with `planner:` (unknown slugs, a slug in two lists, unknown keys, not arrays; on replan, keeping or skipping a place scheduled on a day not being re-planned).

Developed by: LightAISolutions
