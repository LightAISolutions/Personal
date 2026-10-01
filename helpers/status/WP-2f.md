# WP-2f — Prefs kit: the interview: status

**State: done** (2026-10-01). Branch `wp-2f`, worktree `/home/user/wt-4b-2f` (based on `b308e52`, v01.18r), never pushed.
Defaults and reasons: `helpers/decisions/WP-2f.md`.

## Contract (TG-PHASE-4B.md row 2f, the hidden-gems scope addition, TG-PHASE-4.md §8 items 4 and 7)
| Item | State |
|---|---|
| Vocabulary: `climate`, `activities`, `dietary`, `spice`, `meal_style`, `lodging`, `companions`, `planning_style`, `free_time`, `transport`, `languages`; `max_tokens` 3000 | done — `presets/travel.vocab.json`; closed lists where the row gives them (decisions 1–5) |
| Hidden gems (coordinator addition): `gem_appetite` (one, 1–5), `off_track_minutes` (one, 10 · 25 · 45 · 60), `rough_edges` (many, + tolerates / - avoid); defaults recorded | done — same file; machine-readable `default` per dimension, never written to the profile (decision 6) |
| Question bank `travel.interview.json`, 25–40 questions in the named sections, every option one `{dimension, value, polarity}` | done — 39 questions, 13 sections (the 12 named + `hidden-gems`) (decisions 7–12) |
| Schema for the bank | done — `schemas/travel.interview.schema.json` (2020-12 subset, brochure kit validator) + `validateBank` semantic checks (decision 13) |
| Test: every bank dimension exists in the vocab, every closed-list value and polarity legal | done — `kit_prefs_interview.test.js` |
| `interview` command + library function | done — `index.mjs` `interview()` (alias `runInterview`), CLI `interview` |
| Three input shapes (answers object · payload with `interview` · core request envelope) | done — `lib/interview.mjs` `readAnswers` (decision 14) |
| Picks → `owner-chat` evidence (`interview:<qid>`) + auto-built owner decisions document applied in the same call | done — through `ingest()` and `apply()` unchanged in behaviour (decision 20) |
| `decided_at` = created_at (or `--now`) + answer index ms; later answer wins; re-run byte-identical | done — decisions 15, 18; tested |
| Text answers held only when they already carry `{dimension, value, polarity}`; returned in `prefs_review` | done — prose-only answers rejected; `review` payload shape unchanged (decision 22) |
| Output `{applied, held, review, profile_summary}` + `rejected` | done — plus `ok, errors, decided_at, ref, already, superseded, warnings, profile_entries` |
| `profile_summary` ≤ 1 200 plain-text characters | done — decision 23; tested with 54 entries |
| README: dimensions, bank format, command, input shapes, output, the two invariants | done — `helpers/kits/prefs/README.md` (rules 8 and 9) |
| Tests | done — `helpers/tests/kit_prefs_interview.test.js` (15 tests); `kit_prefs_evidence.test.js` adjusted (decision 27) |

## The command line for WP-4d (private repo)
```
node vendor/helpers/kits/prefs/index.mjs interview --vocab travel --bank travel \
  --held quarantine/prefs --profile <PROFILE_FILE from tools/tg-memory.mjs> [--now <ISO>] [--max 8] <to-brain request JSON>
```
- `<answers.json>` may be the core's whole `req_<id>.json`, its `payload`, or `payload.interview`; with the envelope,
  `--now` is optional and ignored (created_at wins), so passing the run's time is harmless.
- `--held` / `--profile` / `--ledger`: whatever `prefs-build-ingest.mjs` uses today (`HELD_DIR`, `PROFILE_FILE`, the
  default ledger beside the profile). `PREFS_REF_SALT` salts `interview:<qid>` refs exactly as `ingest` does.
- Result: `review` → the `prefs_review` envelope payload as is; `profile_summary` → the `profile_summary` envelope (or the
  reply text); `applied` / `already` / `held` / `rejected` → the notice lines `noticeFrom()` builds today.
- Exit 1 with JSON when an answer is rejected or the profile is refused; read `ok` and `rejected`.
- The example `skills/prefs-build/examples/interview-answers.json` must change `heat_tolerance` / `low` to
  `climate` / `heat` / `-` (there is no `heat_tolerance` dimension), and should use bank qids (`pace-01`, …) to avoid
  `warnings` (they are not errors).

## Checks (run from /home/user/wt-4b-2f at the last commit)
- `node --test helpers/tests/` → `# tests 240 · # pass 239 · # fail 0 · # skipped 1` (the Maps kit's by-hand live smoke).
  Prefs kit alone: `node --test helpers/tests/kit_prefs_*.test.js` → 42 tests, 42 pass.
- `node helpers/tools/bundle.mjs --all --check` → `ok: hello — 16 files, 99311 chars, 4 scopes` · `ok: tour-guide — 15 files, 97738 chars, 4 scopes`.
- `node helpers/tools/boundary-check.mjs` → `boundary-check: clean — 271 file(s) under /home/user/wt-4b-2f/helpers` (before the status/decisions files were added).

## Requests to the coordinator (files WP-2f does not own)
1. **README tree** (push-time bookkeeping). New files under `helpers/`:
   - `helpers/kits/prefs/presets/travel.interview.json` — Travel interview question bank (39 questions, 13 sections)
   - `helpers/kits/prefs/schemas/` (new directory) — JSON Schema for interview question banks
   - `helpers/kits/prefs/schemas/travel.interview.schema.json` — Question-bank schema (2020-12 subset)
   - `helpers/kits/prefs/lib/interview-bank.mjs` — Question bank: load and validate against the schema and the vocabulary
   - `helpers/kits/prefs/lib/interview.mjs` — Interview answers: three input shapes, supersede, bank warnings, profile summary
   - `helpers/kits/prefs/fixtures/interview-answers-sample.json` — Invented interview answers, with one planted injection
   - `helpers/tests/kit_prefs_interview.test.js` — Prefs kit: vocabulary, question bank and the interview command
   - `helpers/status/WP-2f.md`, `helpers/decisions/WP-2f.md`
   Changed entries: `index.mjs` description → "Library exports + CLI (check, ingest, review, apply, interview)";
   `presets/travel.vocab.json` → "Travel vocabulary (22 dimensions: pace, food, climate, … hidden-gem appetite)".
2. **WP-3d (payload schemas)**: the `prefs_review` payload is unchanged (`buildReview`). For `profile_summary`, the kit's
   value is a plain-text string ≤ 1 200 characters; an envelope payload `{ text }` with `maxLength: 1200` fits it.
3. **Phase 5 / TG-PHASE-5.md**: the core's interview flow reads `helpers/kits/prefs/presets/travel.interview.json`
   (sections, qids, kinds, labels ≤ 24) and writes answers `{qid, dimension, value, polarity, kind}` taking the triple
   from the tapped option. Skipped questions write nothing; consumers apply `vocab` defaults (decision 6) for
   `gem_appetite`, `off_track_minutes` and `rough_edges`.
4. **WP-2g (Gem Funnel)**: the three stage-0 dimensions and their defaults are in the preset; read them with
   `loadVocab('travel').dims.get('gem_appetite')` etc.

Developed by: LightAISolutions
