# Phase 3 — Tour Guide engine (`packs/tour-guide/`)

> Start this in a **new session** on **Fable 5.1 · effort high** with the prompt: `Read helpers/prompts/TG-PHASE-3.md and execute it exactly.`
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` §3 (facts 1–7, with the Phase 2a corrections above §4), §4.4, §5.3–§5.7, §6 row 3. Written by Phase 2 (`helpers/decisions/TG-PHASE-2.md`); progress in `helpers/BUILD-STATE.md`.

You are the **coordinator** for Phase 3 of the Tour Guide build, and you also build the solver yourself (it is the judgment-heavy part and runs on this session's Fable 5.1 · high). Three work packages run in parallel worktrees; you own the contract files, the merges, the bookkeeping and the single push. Work autonomously inside this repo's conventions; when a choice is not covered by the plan or `helpers/SPEC.md`, pick the sensible default and record it in `helpers/decisions/TG-PHASE-3.md`. Ask the owner only for what §3 names. If something needs the owner, ask in the thread and keep doing everything that does not depend on the answer (owner's standing instruction).

## Step 0 — Orient
1. Read `CLAUDE.md` (it applies in full: session checklist, one push per interaction, push only to this session's `claude/*` branch and wait for it to vanish from the remote before pushing again), `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-2.md`, `helpers/SPEC.md` (§1, §16 — extend the ownership map for this phase in your decisions file, §18) and `helpers/README.md`.
2. Read the four kit READMEs — `helpers/kits/{maps,research,brochure,prefs}/README.md` — they are the contracts the engine consumes. The engine calls the kits as libraries (`import … from '../../kits/maps/index.mjs'`); kit CLIs are run as `node helpers/kits/<kit>/index.mjs <cmd>` (Node does not run a directory's `index.mjs`).
3. Run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`; all three must be clean before any work starts. Confirm the `helpers-dist` branch carries `kits/` (published by the merge of Phase 2).
4. `AssistantBrain` stays reference only; `TourGuide` is not touched in this phase. No live Google API call in this phase: the engine runs on fixtures and recorded (hand-written) responses through the Maps kit's mock transport.

## Step 1 — Fan out
One worktree and branch per WP, never pushed: `git worktree add ../wt-3<x> -b wp-3<x>`. Each WP gets a brief that quotes its row from §2, its paths, and the rules at the end of this file (the Phase 2 coordinator's common-rules brief is a good model: worktree-only edits, no repo bookkeeping in a WP, CommonJS tests that `await import()` ESM, CI has no npm install / network / Chromium, the boundary-check gotchas — no `trips/` or `places/` directories, no file names starting with `profile`, no phone-shaped numbers, no base64 blobs). Each WP writes `helpers/status/WP-3<x>.md` and `helpers/decisions/WP-3<x>.md`. Agents (`.claude/agents/`): 3a and 3c `hb-builder-opus` (Opus 5.5 · high); 3b is built by **you** in this session (Fable 5.1 · high), in `../wt-3b`, or by an `hb-builder-fable` agent if you prefer to stay a pure coordinator — record which.

Layout: `helpers/packs/tour-guide/{helper.json, README.md, schemas/, estimator/, planner/, later/, brochure-map/, fixtures/}`; tests `helpers/tests/pack_tour-guide_*.test.js`. `gas/` stays empty until Phase 5 — if `bundle --all` needs a minimal `helper.json` + `gas/` for the pack to bundle, add the smallest valid one (display name "Tour Guide", `property_prefix: ""` per Phase 1 decision 2) and keep `bundle --all --check` green.

## Step 2 — The work packages (plan §6 row 3)
| WP · who | Deliverable | Contract |
|---|---|---|
| **3a Schemas, estimator, Later lists, fixtures** · `hb-builder-opus` | `packs/tour-guide/{schemas,estimator,later,fixtures}/` | JSON Schemas for every §4.4 entity (`Trip`, `Place`, `VisitEstimate`, `PlaceNote`, `DayPlan`, `LaterList`, `GoogleSnapshot` — the snapshot shape is the Maps kit's, content build-scoped). **Estimator** (plan §5.3) on top of the research kit's `durationRange`: activity + sources → min/max, chosen minutes adjusted by pace and the profile's interest level, confidence; **calibration** from "longer / shorter / about right" taps per category, bounded and reversible. **Later lists** (§5.5): statuses candidate · scheduled · saved-for-later · rejected, named lists with reasons, promote/demote with "re-plan only the affected day" signalled to the caller. **Two fixture trips with invented data**: a 3-day transit city and a 4-day driving loop, each with candidate places (hours, closed days, invented coordinates), recorded Place Details / Route Matrix / Compute Routes responses in the Maps kit's real shapes, lodging per night, pace, and at least one place that is closed on a trip day and one that only fits outside the day |
| **3b Planner + solver** · coordinator (Fable 5.1 · high) | `packs/tour-guide/planner/` | Plan §5.4 a–f: (a) drop stops closed on the date or outside their hours; (b) cluster places into days by geography, lodging and constraints (≤ 10 stops per transit cluster — the 100-element TRANSIT matrix cap); (c) order each day with a **time-window-aware solver** over the Route Matrix in the day's mode (open/close windows, visit minutes from the estimator, start/end at lodging, day start/end from the trip); (d) fetch real legs pair by pair with the planned departure time (TRANSIT takes no intermediates); (e) insert meals and free-time blocks by pace; (f) a Maps link per leg and per day (Maps kit URL builder). Driving and walking days also ask `optimizeWaypointOrder` and the plan records any disagreement. Output `DayPlan`s with warnings (closed day, tight connection, over-long day) and `verified_on`; anything not scheduled goes to a Later list with its reason. Deterministic for a given input (seeded); a budget estimate of Maps SKUs per plan before any call |
| **3c Plan → brochure mapping** · `hb-builder-opus` | `packs/tour-guide/brochure-map/` | Maps `Trip` + `DayPlan`s + `PlaceNote`s + Later lists + build-scoped snapshot content into the brochure kit's input model (its README and schema), including the attribution sources the brochure kit requires; renders the fixture trips' brochures to HTML in tests (PDF only when Playwright and Chromium are present) |

**Property tests** (Phase 3 done-when): for both fixtures and for randomized invented inputs — no stop outside its opening hours, no visit on a closed day, every leg's minutes match the matrix / recorded leg for its planned departure, day stays inside day start/end (or carries an over-long warning), every candidate is either scheduled or in a Later list with a reason, re-planning one day leaves the others unchanged.

Coordinator: merge each WP when its status file says done, run the three checks, resolve conflicts by the ownership map. Review each README against its row before merging.

## Step 3 — Owner input
None required. Optionally show the owner the two fixture brochures (HTML or PDF) built from the planner's output as a preview of a real plan, and ask nothing else.

## Step 4 — Done when (plan §6 row 3)
- Feasible plans for both fixtures (no stop outside hours, no closed-day visit, legs match the matrix); property tests green in `node --test helpers/tests/`.
- `bundle --all --check` and the boundary check clean; `helpers-ci` green on the push.
- No id, secret, personal string, trip or place of the owner's in `helpers/`; fixtures are invented.

## Step 5 — Repo bookkeeping (this repo's `CLAUDE.md`)
Single push commit after all WPs are merged: version bump, CHANGELOG section with the verbatim prompt, README tree entries for every new file, README `Last updated`, `REPO-ARCHITECTURE.md` if the Helper Framework subgraph needs the pack (regenerate the mermaid.live URL per `.claude/rules/mermaid-diagrams.md`), `Developed by: LightAISolutions` on every new file.

## Step 6 — Hand off Phase 4
Write `helpers/decisions/TG-PHASE-3.md` (coordinator defaults, ownership-map extension, solver design and its limits), update `helpers/BUILD-STATE.md` (Phase 3 done, log, Next), and write `helpers/prompts/TG-PHASE-4.md` for the brain side in the private repo (plan §6 row 4: routine-mode `CLAUDE.md`, skills `prefs-build`, `trip-research`, `place-notes`, `plan-days`, `brochure-build`, `chat`, `trip-check`, memory dirs, merge workflow, `SESSION-CONTEXT.md`, `routines/*.prompt.md`, the first `vendor/helpers/` subtree pin of `helpers-dist`; `trip-research` and `plan-days` on **Fable 5.1 · high**, the rest **Opus 5.5 · high**; carry the Phase 2 requests listed in `helpers/decisions/TG-PHASE-2.md` §4). Then run `remember session`, push, and tell the owner: "Phase 3 done. Start a new session on Fable 5.1 · high and paste: `Read helpers/prompts/TG-PHASE-4.md and execute it exactly.`"

## Rules
- Public repo: never commit ids, secrets, e-mail addresses, phone numbers, names, trip or place data of the owner's, or anything from a private repo. Fixtures use invented data and reserved domains.
- Edit only the paths your WP owns; requests for anything else go in your status file.
- No live Google API calls and no other network calls in this phase.
- Never edit `.github/workflows/auto-merge-claude.yml`, `scripts/setup-gas-project.sh` or the GlobalACL / MasterACL machinery.
- If a usage limit pauses the session, leave `helpers/BUILD-STATE.md` and the status files accurate and resume in a new session from this prompt.

Developed by: LightAISolutions
