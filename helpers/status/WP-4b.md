# WP-4b — prefs-build, place-notes, brochure-build: status

> Generic copy of the private repo's `repository-information/status/WP-4b.md` (TourGuide, branch `claude/tg-phase-4-18ndyh`); every trip, place and id named here is invented fixture data.

**State: done** (2026-10-01). Branch `wp-4b`, worktree `tg-wt-4b`, never pushed. Defaults and reasons: `helpers/decisions/WP-4b.md`.

## Contract (TG-PHASE-4 row 4b + coordinator design points)
| Item | State |
|---|---|
| `skills/prefs-build/SKILL.md` — frontmatter + six sections; `prefs` request; Gmail / Calendar / Drive / Takeout queries and windows; evidence records to scratch | done |
| `skills/prefs-build/prefs-build-ingest.mjs` — kit check + ingest (`--vocab travel --held <repo>/quarantine/prefs`, ledger beside `profile/travel-profile.md`, salt from `PREFS_REF_SALT` via `--salt-env`) + review → `notice.json` (≤ 40 lines: statement, support, cid) and `prefs-review.json` | done |
| Profile and decisions ledger never written by the skill; `apply` (Phase 5 `prefs_decisions`) noted as not built here | done — decisions 13 |
| `prefs_review` payload kept as the future envelope's payload | done — `examples/prefs-review-payload.json` |
| `skills/place-notes/SKILL.md` — `notes` request; research kit procedure, budgets 20/40/30 shared; untrusted excerpts → `quarantine/<date>-notes-<slug>.md` via `quarantineFile()`; reply = count + unsourced | done |
| `skills/place-notes/place-notes-todo.mjs` (`--repo --trip [--places] [--max-age-days 180] [--today]`) | done |
| `skills/place-notes/place-notes-write.mjs` (schema-validates each PlaceNote, `savePlace()` keeping `## Owner notes`, prints the count; `--out` writes the reply payload) | done |
| `skills/brochure-build/SKILL.md` — `brochure` request; Plan JSON from Drive; render; Drive create-file under `TourGuide/trips/<slug>/`; reply with link(s); HTML-only path | done |
| `skills/brochure-build/brochure-build-render.mjs` (`fetchSnapshots(… tier enterprise, store)`, `renderPlanPdf`, HTML always written, `store.purge()` in `finally`, exit 3 = HTML only, `show_google_content` request > trip `profile_overrides` > true) | done |
| `routines/{prefs-build,place-notes,brochure-build}.prompt.md` — exact prompt shape, nothing else | done |
| `examples/` per skill — invented / fixture data, reserved domains only | done |
| Dry run of each skill on both fixtures, every envelope through `envelope.mjs --pack tour-guide` with no `errors` | done — below |

## Dry runs (scratch outside the repo; `S` = the WP scratch dir)
Seed: `node tools/seed-from-fixture.mjs transit-city|driving-loop $S/<tree> [--no-notes]`.
- **prefs-build**, both trees: `node skills/prefs-build/prefs-build-ingest.mjs --repo $S/<tree> --evidence vendor/helpers/kits/prefs/fixtures/evidence-sample.json --out $S/<tree>-out/prefs` → exit 0; 16 records valid, 2 suspect (the planted injection and the unknown-sender invite), 13 candidates, 13 held notes in `quarantine/prefs/`, review 11 items + 2 held back (suspect only); `profile/` untouched (no ledger written). Rerun: 16 duplicates, 0 files rewritten, same `batch_id`. Driving-loop run with `PREFS_REF_SALT` set → `salted: true`. Malformed evidence → exit 1 with the kit's reasons; missing args → exit 2. `envelope.mjs notice prefs-build … --pack tour-guide --in-reply-to … --dedupe-key prefs-review-<batch_id>` → no errors (both trees); `envelope.mjs prefs_review …` → "unknown type: prefs_review" (expected until Phase 5).
- **place-notes**, both trees seeded `--no-notes`, then `node skills/brochure-build/examples/make-dry-run-plan.mjs <fixture> <tree> <out>` (stands in for plan-days): transit-city 12 scheduled + 2 saved, driving-loop 13 + 2. `place-notes-todo.mjs` → 14 / 15 places to note (exit 0). `place-notes-write.mjs … --out` with the fixture's notes JSON → 9 / 8 written, 5 / 7 reported "could not source"; rerun → 0 written, 9 unchanged; hand-written `## Owner notes` kept across the rewrite; invalid notes (instruction-shaped text, unknown place_id, no source, schema) all refused, exit 1. `envelope.mjs reply place-notes …` → no errors (both).
- **brochure-build**, same trees: `MAPS_SNAPSHOT_STORE=$S/…/snapshots.json node skills/brochure-build/brochure-build-render.mjs --repo <tree> --trip <slug> --plan <out>/plan-<build_id>.json --out <out>/brochure --maps fixture:<fixture>` → exit 0, `pdfAvailable()` true (Chromium at `/opt/pw-browsers/chromium`): transit-city 11 pages, 14 snapshots; driving-loop 12 pages (also `--page a4`), 15 snapshots; 0 warnings; store afterwards holds 0 records with content. `BROCHURE_CHROMIUM=/none … --show-google false` → exit 3, HTML only, "Verify before you go" section present. Trip `profile_overrides.show_google_content: false` → off; `--show-google true` wins. Plan for another trip / unknown trip → exit 1. `envelope.mjs reply brochure-build …` → no errors (both).

## Checks
- `node --test vendor/helpers/tests/` (from `vendor/helpers`) → 206 tests, 205 pass, 1 skipped, 0 fail (vendor untouched).
- `node vendor/helpers/tools/boundary-check.mjs` → clean (228 files); with `--root <worktree> skills/prefs-build skills/place-notes skills/brochure-build routines` → clean.

## Requests to the coordinator
1. `routines/README.md` routine table rows (file not owned here):
   `| PREFS_BUILD | prefs-build | fired by the core (prefs) | Google Drive, Gmail, Google Calendar | Sonnet · medium |`
   `| PLACE_NOTES | place-notes | fired by the core (notes) | Google Drive | Sonnet · high |`
   `| BROCHURE_BUILD | brochure-build | fired by the core (brochure) | Google Drive | Sonnet · medium |`
   PLACE_NOTES needs web search/fetch allowed in the routine environment; BROCHURE_BUILD needs the environment's Maps credentials (`MAPS_USAGE_LEDGER`, `MAPS_SNAPSHOT_STORE`); PREFS_BUILD needs `PREFS_REF_SALT`.
2. Phase 5 (`chat` / core): turn the owner's `confirm|edit|reject <cid>` replies to the prefs notice into a `prefs_decisions` document for the kit's `apply`; register `prefs_review` in `helper.json` `envelope_types` and switch prefs-build to emit `out/prefs-review.json` as that type.
3. `plan-days` should set `profile_overrides.show_google_content` when the owner states a standing answer (brochure-build reads it there) and may replace `skills/brochure-build/examples/make-dry-run-plan.mjs` in the dry runs once merged.
4. No framework patch requested.

## Log
- 2026-10-01 — read the briefs, CLAUDE.md, skills/routines READMEs, tg-memory / tg-maps / seed tools, SPEC §2–3/§18, pack, prefs, research, brochure and maps kit READMEs; wrote the three drivers, the dry-run plan helper, SKILL.md files, routine prompts, examples; dry-ran each skill on both fixtures; checks green.

## Coordinator follow-up (after the merge)
- Request 1: the routine table (`routines/README.md`, WP-4c) carries the three rows; the model column keeps the build plan's default (Opus 5.5 · high) — the Sonnet suggestion is recorded for the owner in `helpers/decisions/TG-PHASE-4.md`.
- Request 2 recorded for Phase 5. Request 3 applied: `plan-days --show-google true|false` writes `profile_overrides.show_google_content`; the merged dry run drives brochure-build from the plan-days plan (`make-dry-run-plan.mjs` stays as a development helper).

## Interview answers (delta, TG-PHASE-4-DELTA §3.5)
Driver `skills/prefs-build/prefs-build-ingest.mjs --interview FILE` (the answers object, a payload carrying `interview`, or the core's whole request envelope): every answer → one `owner-chat` evidence record (`source_ref` `interview:<qid>`) ingested with any connector evidence; picks → decisions document (`source:"owner"`, `via:"telegram"`, one confirm per pick, ≤ 50 per document) → kit `apply`; then review; text answers stay held candidates. `TODO(4b)` in the driver header and in SKILL.md step 2. Notice capped at 40 lines and 4000 chars (title + text, after HTML escaping). SKILL.md says what to do on a refused profile: report, log `profile refused`, never force.

Dry run (`S/iv`; invented `skills/prefs-build/examples/interview-answers.json`: 9 picks, 3 text answers incl. one instruction-shaped, 1 answer on a dimension the vocabulary lacks; `--decided-at 2026-09-30T18:00:00Z`, `PREFS_REF_SALT` set):
- **transit-city tree, `profile/travel-profile.md` removed:** 12 records ingested (1 answer rejected: `unknown dimension: heat_tolerance`), 12 candidates, 1 suspect. 8 picks confirmed → kit created `profile/travel-profile.md` (8 entries in 6 sections + kit trailer) and `travel-profile.decisions.json`; 1 pick not saved (`day_rhythm` "late" as a "no": not confirmable, negative single value). Review: 2 items (the text answers "night markets", "regional bakeries", support 1 each) + 2 held back (the "late" pick; the instruction-shaped answer as `suspect_only`, pattern-1 + pattern-6). Notice 21 lines, 1149 escaped chars; exit 1 (the rejected answer is a finding).
- Envelope: `envelope.mjs notice prefs-build out/notice.json --pack tour-guide --in-reply-to 00000000-0000-4000-8000-0000000000b2 --dedupe-key prefs-review-pfb_acc21cf6650646a8` → errors `[]` (`examples/interview-notice-envelope.json`).
- Re-run, same answers: 0 added, 12 duplicates, 0 saved, 8 "already saved"; profile and ledger byte-identical.
- Same answers as the full request envelope (`producer: tour-guide-core`, no `--decided-at`): decided_at taken from `created_at`, profile identical to the file-form run.
- **Hand-written profile** (normally seeded transit-city tree) + the kit's `evidence-sample.json`: 28 records, 3 suspect, 18 candidates; `apply` refused ("not a prefs-kit profile (no kit trailer)"), profile untouched (same sha1), no ledger written; notice opens with "Interview picks NOT saved: …", 14 to decide, 26 lines.
- Conflict: two invented connector records "pace relaxed −" + the "relaxed +" pick → pick not saved ("other evidence outvotes it; held for review"), 7 saved.
- Size: 20 long items + 30 held + 60 saved picks with `&<>` → 37 lines, 3961 escaped chars.
- Evidence-only path unchanged: the committed `examples/notice-payload.json` regenerates byte-identical.
- Checks: `node --test vendor/helpers/tests/` 205 pass, 1 skipped; boundary check clean (228 files; `--root <worktree> skills/prefs-build routines` clean, 18 files).

Developed by: LightAISolutions
