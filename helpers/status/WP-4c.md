# WP-4c — `chat`, `trip-check`, routine table, memory-merge check: status

> Generic copy of the private repo's `repository-information/status/WP-4c.md` (TourGuide, branch `claude/tg-phase-4-18ndyh`); every trip, place and id named here is invented fixture data.

**State: done** (2026-10-01). Branch `wp-4c`, worktree `tg-wt-4c`, never pushed. Defaults and their reasons: `helpers/decisions/WP-4c.md`.

## Contract (TG-PHASE-4.md, row 4c)
| Item | State |
|---|---|
| `chat` SKILL.md: frontmatter + Purpose, Inputs, (Procedure), Output, Memory, Silence rule, Safety; kinds `message` / `ask`; other kinds → one `log/` line | done — `skills/chat/SKILL.md` |
| Fire text validated against `to-brain/req_<id>.json` and `state.json` `requests_open`; silence on bad id, missing file, wrong kind, already answered | done — `chat-context.mjs` `checkRequest()` (reasons `bad_fire_text`, `id_mismatch`, `not_a_request`, `kind_not_owned`, `not_open`) |
| `chat-context.mjs --repo [--trip] [--date] [--plan]`: trips, resolved trip's candidates + statuses, latest build's day summaries + Later lists, the day's numbered stops/legs with `--plan` | done (+ `--request/--fire-text/--state`, `--match`, `--place`, `--now`, `--tz`) |
| Classes (a) memory/plan · (b) web via the research kit (10 searches / 20 fetches / 15 min) · (c) plan change → one-line proposal + fenced hand-off block · (d) side effect → no proposal while `action_allowlist` is empty | done — SKILL.md steps 3–7 |
| Reply ≤ 4000 chars, verb-first, tz rules; hand-off shape checked (kinds, fields, trip, dates, slugs; never `allowOverBudget`) | done — `chat-check.mjs` |
| `trip-check` SKILL.md (weekly, one `notice` only on change, else silent) | done — `skills/trip-check/SKILL.md` |
| `trip-check-run.mjs --repo --maps --plans [--now]`: upcoming trips with a build, `fetchSnapshots(… buildId '<build_id>-check-<date>', tier, store)`, compare with `hoursOn`; closed / hours / moved > 100 m / gone; one notice listing every change; store purged | done (+ `--list`, `--out`, `--store`, `--baseline`, `--tier`) |
| Tier: Enterprise, not Essentials (Essentials carries no hours or status); weekly cost recorded | done — decisions §T1 |
| `routines/chat.prompt.md`, `routines/trip-check.prompt.md` (prompt text only) | done |
| Routine table: 7 rows, trigger, connectors, model, fire name; `CRON_TZ` line; Environment note | done — `routines/README.md` |
| Memory-merge check (union for `log/*.md`, three-way JSON ledger, true conflict aborts, non-memory branch skipped) | done — experiment below; one request (R1) |
| Dry runs on both fixtures; envelopes pass `envelope.mjs` | done — below; artefacts in `skills/*/examples/` |

## Checks (in this worktree)
- `cd vendor/helpers && node --test tests/` → 206 tests, 205 pass, 1 skipped, 0 fail.
- `node vendor/helpers/tools/boundary-check.mjs` → clean (228 files).
- Every `skills/*/examples/*.json` parses; no scratch path, key, token or personal data in the new files (grep).

## Dry runs (scratch `…/scratchpad/wp-4c/run2`, no network: `--maps fixture:<name>`, `MAPS_USAGE_LEDGER` / `MAPS_SNAPSHOT_STORE` unset)
Setup, per fixture: `node tools/seed-from-fixture.mjs <fixture> $S/<t>` → `node skills/trip-check/examples/build-fixture-plan.mjs <fixture> $S/<t> $S/plans` (planTrip on the fixture + mock client, Plan saved, build recorded in `trips/<slug>.md`) → `examples/make-baseline.mjs` (location baseline) → `examples/edit-fixture-plan.mjs` (broken copy).

| Run | Command (abridged) | Result |
|---|---|---|
| trip-check, transit-city, unchanged | `trip-check-run.mjs --repo $S/tc --maps fixture:transit-city --plans $S/plans --baseline base-tc.json --now 2027-05-05T11:00:00Z` | exit 0; 12 stops checked, 0 changes, `notice: null` (silent); purge stripped 12 |
| trip-check, driving-loop, unchanged | same with `fixture:driving-loop`, `--now 2027-06-02T11:00:00Z` | exit 0; 13 checked, 0 changes, silent; purge stripped 13 |
| trip-check, transit-city, edited plan | `--plans $S/plans-edited` | exit 1; changes `closed_business` (05-12), `closed_day` (05-13, Thursday), `outside_hours` (05-14, stop moved to 08:30 before a 09:30 opening); notice written |
| trip-check, driving-loop, edited plan + shifted baseline | `--plans $S/plans-edited --baseline base-dl-shift.json` | exit 1; `moved` 1112 m (06-09), `gone` (06-10, unknown id → 404); notice written |
| trip-check edge cases | `--list`; `--now` after the trip; empty `--plans`; mid-trip `--now`; `--maps live` without ledger; `--tier pro` | `needed[]` listed · `skipped: past`, exit 0 · `plan_missing`, exit 1 · only today-or-later stops (8) · error, exit 1 · usage, exit 2 |
| envelopes (trip-check) | `envelope.mjs notice trip-check <notice.json> --pack tour-guide --dedupe-key trip-check-<date>` ×2 | `errors: []` both |
| chat, transit-city, class (a) | `chat-context.mjs --request req_7c1d….json --fire-text req_7c1d… --state state.json --date 2027-05-13 --plan <plan>` | exit 0; request ok (`ask`), trip by `only_active`, 4 numbered stops with legs and lines; reply drafted from it |
| chat, driving-loop, class (c) | `--request req_8d2e….json … --date 2027-06-09 --plan <plan>` | exit 0; trip resolved `by: text`; reply with a `replan` hand-off for 2027-06-09 |
| chat silence | bad fire text; request id not in `requests_open` | exit 1, `bad_fire_text` (nothing else read) · exit 1, `not_open` |
| chat-check | both replies; a bad hand-off (`allowOverBudget`, date outside the trip) | ok ×2 · exit 1 with both errors |
| envelopes (chat) | `envelope.mjs reply chat <reply.json> --pack tour-guide --in-reply-to <id> --dedupe-key chat-<id>` ×2 | `errors: []` both |

Class (b) (web) was not dry-run: it needs live WebSearch/WebFetch; the research kit procedure it follows is the kit's own, tested in `vendor/helpers/tests/`.

## Memory-merge check
Read: `vendor/helpers/packs/tour-guide/helper.json` `memory_dirs` = `trips, places, profile`; `scripts/merge-routine-memory.sh` `ALLOW='^(log|quarantine|trips|places|profile)(/[^/]+)?/[^/]+\.(md|json)$'`; `.gitattributes` `log/*.md merge=union`; the workflow runs the script from `main` on every `claude/**` push. Coverage matches `memory_dirs` + `log/` + `quarantine/`.

Experiment (scratch `…/wp-4c/merge`): a bare `origin.git`, `main` with the worktree's `.gitattributes` and script, `log/2027-01-01.md`, `log/maps-usage-ledger.json` (units 3), `skills/README.md`; nine `claude/*` branches pushed; then, from a fresh clone, `bash scripts/merge-routine-memory.sh` (sweep, as CI).
- `git check-attr merge` → `log/2027-01-01.md: union`, `log/maps-usage-ledger.json: unspecified`, `trips/x.md: unspecified` (the JSON ledger is not union-merged).
- `log-a`, `log-b` (each appends a line to the same day) → both merged, both lines kept.
- `newday-a`, `newday-b` (each creates the same new day file: add/add) → both merged, header once, both lines.
- `ledger-a` (units 3 → 15) → merged three-way; `ledger-b` (units 3 → 16, from the old base) → `CONFLICT`, `git merge --abort`, branch left, script exit 1.
- `dev` (touches `skills/README.md` and a log) → `skip: touches non-memory paths`, left untouched.
- `nested-ok` (`quarantine/prefs/held.md`) → merged; `nested-deep` (`trips/a/b/c.md`) → skipped.
- Result: `merged=6 conflicts=1`, exit 1 — every property the brief asks for holds.
- Follow-up: with the driver proposed in R1 configured, `scripts/merge-routine-memory.sh claude/ledger-b` merged cleanly to units 28 (= 3 + 12 + 13), `updated_at` = the later side.

## Requests to the coordinator
1. **R1 — ledger conflicts are the normal case, not the exception.** Every Maps-spending run rewrites `updated_at` and its SKU rows, so any two such runs that start from the same `main` (e.g. Monday's `trip-check` and a `plan-days` run before the first merge lands) conflict; the second branch — its log line and any `trips/` memory with it — is then left for the owner and the workflow goes red. Proposed patch (paths not owned by this WP):
   - `.gitattributes`: add `log/maps-usage-ledger.json merge=maps-ledger` (keep `log/*.md merge=union`).
   - `.github/workflows/merge-routine-memory.yml`, before `bash scripts/merge-routine-memory.sh`: `git config merge.maps-ledger.name "maps usage ledger: sum both sides' spend"` and `git config merge.maps-ledger.driver "node scripts/merge-maps-ledger.mjs %O %A %B"`.
   - `scripts/merge-maps-ledger.mjs` (tested in the experiment): read `%O %A %B` as JSON; exit 1 unless both sides are `{v:1, kind:"maps-usage-ledger", months:{}}`; for every month × SKU × field write `ours + theirs − base`; `updated_at` = the later of the two; write the result over `%A`, exit 0. A malformed file still conflicts. Proposed file (tested in the experiment):

```js
#!/usr/bin/env node
// Proposed (not in the repo): git merge driver for log/maps-usage-ledger.json — `node scripts/merge-maps-ledger.mjs %O %A %B`.
// Both sides spent their units independently, so per (month, sku, field): result = ours + theirs − base; updated_at = the later one.
// Writes the result over %A and exits 0; anything that is not a v1 maps-usage-ledger exits 1 (git then reports a conflict).
import fs from 'node:fs';
const [basePath, oursPath, theirsPath] = process.argv.slice(2);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8') || '{}'); } catch { return null; } };
const base = read(basePath) || {}, ours = read(oursPath), theirs = read(theirsPath);
const ok = (d) => d && d.v === 1 && d.kind === 'maps-usage-ledger' && d.months && typeof d.months === 'object';
if (!ok(ours) || !ok(theirs)) process.exit(1);
const n = (d, m, s, k) => Number(d?.months?.[m]?.[s]?.[k] ?? 0);
const out = { ...ours, updated_at: [ours.updated_at, theirs.updated_at].filter(Boolean).sort().pop() || null, months: {} };
for (const m of new Set([...Object.keys(ours.months), ...Object.keys(theirs.months)])) {
  out.months[m] = {};
  for (const s of new Set([...Object.keys(ours.months[m] || {}), ...Object.keys(theirs.months[m] || {})])) {
    const row = {};
    for (const k of new Set([...Object.keys(ours.months[m]?.[s] || {}), ...Object.keys(theirs.months[m]?.[s] || {})])) row[k] = n(ours, m, s, k) + n(theirs, m, s, k) - n(base, m, s, k);
    out.months[m][s] = row;
  }
}
fs.writeFileSync(oursPath, JSON.stringify(out, null, 2) + '\n');
// Developed by: LightAISolutions
```
2. **R2 — location baseline for `moved`.** The Plan and the Place schema hold no coordinates, and routine containers do not keep `MAPS_SNAPSHOT_STORE` between weeks, so live runs will mostly report `no_baseline` and never `moved`. Proposal for the plan-days owner / skills/README.md: record `locations: { <place_id>: { lat, lng, fetched_at } }` beside `builds[]` in the trip data block (allowed ≤ 30 days by the Maps terms; README already says a Place may keep lat/lng ≤ 30 days), refreshed by each build and by `trip-check`, entries older than 30 days dropped on every write. `trip-check-run.mjs` would read it as a third baseline source (a few lines). Until then `moved` works only when the store survives.
3. **R3 — structured replan fields.** A `replan` hand-off carries a move/drop/promote only in `reason` words. Phase 5's core and `plan-days` will want `drop`, `add`, `promote` (slug lists) on `replan`; if added to `skills/README.md`'s kinds table, extend `HANDOFF_FIELDS` in `skills/chat/chat-check.mjs`.
4. **R4 — Phase 5 must strip or honour the hand-off block.** The core sends `reply` text verbatim; until it parses the fenced `{"handoff":…}` block (turn it into a `req_<id>.json` after the owner confirms), the owner sees the JSON. Hand-offs carry only slugs, dates and a short reason, so that is harmless meanwhile.

## Log
- 2026-10-01 — read the briefs, CLAUDE.md, skills/ and routines/ READMEs, tg-memory/tg-maps/seed, SPEC §2/§3/§7/§10/§18, pack README, Maps and research kit READMEs, planner hours; built fixture plans; wrote `chat-context.mjs`, `chat-check.mjs`, `trip-check-run.mjs` and the three example scripts; dry-ran both skills on both fixtures; ran the merge experiment and tested a ledger merge driver; wrote both SKILL.md files, both prompts, the routine table and Environment note; tests and boundary check green.

## Coordinator follow-up (after the merge)
- R1 applied: `scripts/merge-maps-ledger.mjs` (the tested driver), `.gitattributes` `log/maps-usage-ledger.json merge=maps-ledger`, the two `git config` lines in `.github/workflows/merge-routine-memory.yml`; mirrored into the framework's private-repo template.
- R2 applied: `plan-days` writes `locations` (`{ <place_id>: { lat, lng, fetched_at } }`, ≤ 30 days) into the trip data block on every build; `trip-check-run.mjs` reads it as the first baseline source. Dry run from the merged branch: `no_baseline` 0 on both fixtures, a shifted location reports `moved 1112 m`.
- R3 applied: `replan` hand-offs take `promote` / `demote` (slug lists) and `plan` takes `show_google_content`; `HANDOFF_FIELDS` and the SKILL.md updated; a `demote` hand-off passes `chat-check.mjs`.
- R4 recorded for Phase 5 (`helpers/prompts/TG-PHASE-5.md`).

Developed by: LightAISolutions
