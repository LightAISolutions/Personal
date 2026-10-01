# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with project-specific versioning (`w` = website, `g` = Google Apps Script, `r` = repository). Older sections are rotated to [CHANGELOG-archive.md](CHANGELOG-archive.md) when this file exceeds 100 version sections.

`Sections: 16/100`

## [Unreleased]

*(No changes yet)*

## [v01.16r] — 2026-10-01 03:16:38 AM EST

> **Prompt:** "Restart both threads from where they started on whichever AI model and effort level they were at before the pause"

### Added
- `helpers/decisions/TG-PHASE-4.md` — Phase 4 (Tour Guide brain side in the private repo): coordinator defaults, the request-kind contract as implemented (`research` with `intake` / `more` / `decided`, `plan` with `picks` / `later` / `skip` / `deliverables`, `replan`, `notes`, `brochure`, `prefs` with interview answers, free text), the `shortlist` / `trip_facts` / `prefs_review` payloads the drivers already write, the Drive and memory layout, every driver's name and flags, the routine table, what each skill needs from the core, a "For Phase 4b" section, requests carried, checks at push
- `helpers/status/WP-4a.md`, `WP-4b.md`, `WP-4c.md` and `helpers/decisions/WP-4a.md`, `WP-4b.md`, `WP-4c.md` — generic copies of the private repo's per-package status (contract tables, dry runs on the two invented fixture trips, requests) and defaults
- `helpers/templates/private-repo/scripts/merge-maps-ledger.mjs` — git merge driver for `log/maps-usage-ledger.json`: per month × SKU × field `ours + theirs − base`, `updated_at` the later side; anything that is not a v1 ledger still conflicts

### Changed
- `helpers/templates/private-repo/.gitattributes`, `.github/workflows/merge-routine-memory.yml`, `scripts/merge-routine-memory.sh`, `README.md` — the Maps ledger merges through the new driver (`merge=maps-ledger`, two `git config` lines before the sweep) and the memory allow-list accepts `.json` files; the template README names the new script
- `helpers/tests/tools_new_helper.test.js` — a rendered private repo must carry the merge driver and the `.gitattributes` line
- `helpers/BUILD-STATE.md` — Phase 4 done, the TourGuide repo row, Phase 4b marked next, Phase 4 log, Next (Phase 4b kickoff)
- `README.md` — tree entries for every new file
- `repository-information/SESSION-CONTEXT.md` — session context saved

## [v01.15r] — 2026-10-01 02:50:57 AM EST

> **Prompt:** "In my project goal, I forgot to mention that my vision for the final product is a chatbot via Telegram that starts me off with an extensive interview about my food & activity preferences, hot/cold tolerance, and other useful questions that helps it understand my likes and dislikes. Then, I want to have multiple commands that I can give it to automate tasks, such as "/plan Tokyo, Japan" and it would review the information available to it via my connectors related to "Tokyo, Japan", conduct additional web research to see current options and evaluate them for me, recommend me several activities/food options, then takes my choices and generates a professional, beautiful travel brochure like the sample you gave me. Given the context above, amend the plan (both built and unbuilt) to implement my vision."

### Added
- `helpers/prompts/TG-PHASE-4-DELTA.md` — additions for the running Phase 4 session: `plan` requests gain `later`, `skip` and `deliverables` beside `picks`; the research skill writes a structured shortlist and handles an `intake` scope; `prefs-build` accepts interview answers; the hand-off now points at Phase 4b
- `helpers/prompts/TG-PHASE-4B.md` — new gap-closure phase (Fable 5.1 · high): core flows primitive and Telegram document delivery (WP-1b), prefs interview bank, eleven new vocabulary dimensions and an `interview` command (WP-2f), engine choices, statuses and the five pack envelope types (WP-3d), TourGuide skill deltas and pin bump (WP-4d)
- `helpers/prompts/TG-PHASE-5.md` — Telegram commands and flows phase (Opus 5.5 · high): `/start`, `/interview`, `/profile`, the five-step `/plan` flow, envelope handlers and sheets, Lane B and `/route`; carries a FINALIZE block Phase 4b fills in

### Changed
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — amended for the owner's Telegram vision: scope and §4 architecture, data model (trip and place statuses, Shortlist, FlowState, PlanDigest), §5.1 interview-first preferences, §5.2/§5.7/§5.8 additions, new §5.9 owner's journey (`/plan <destination>` as a five-step chat flow ending in a brochure PDF), §6 gap work packages 1b/2f/3d and a new Phase 4b, Phases 5–8 rewritten, §8 per-plan costs, §9 four new risks, §10 decisions 14–17, new §11b amendment summary, §12 kickoff
- `helpers/BUILD-STATE.md` — gap rows 1b/2f/3d, Phase 4 marked in progress with its delta file, new Phase 4b row, Phases 5–8 rewritten, plan amendment log, Next updated
- `README.md` — tree entries for the three new prompt files
- `repository-information/SESSION-CONTEXT.md` — session context saved

## [v01.14r] — 2026-10-01 01:56:30 AM EST

> **Prompt:** "Read helpers/prompts/TG-PHASE-3.md and execute it exactly."

### Added
- `helpers/packs/tour-guide/` — the Tour Guide engine pack (Phase 3): `helper.json` manifest (name `tour-guide`, Drive root `TourGuide`, memory dirs `trips places profile`, `timezone` default `America/New_York`, empty `gas/` until Phase 5) and a pack README that walks the data flow
- `helpers/packs/tour-guide/schemas/` — JSON Schemas for `trip`, `place`, `google-snapshot`, `visit-estimate`, `place-note`, `calibration`, `day-plan`, `later-list`, `plan`, `profile-excerpt`, plus cross-field and date checks; `validate(entity, kind)` → `{ ok, errors }`
- `helpers/packs/tour-guide/estimator/` — visit-duration estimator: `buildEstimate` from notes, snapshot and category defaults, `chooseMinutes` by pace, calibration state with `createCalibration` / `applyTap` / `calibrationFactor`
- `helpers/packs/tour-guide/later/` — saved-for-later lists: `createLists`, `addItem`, `promote` (returns `affected_days`), `demote`
- `helpers/packs/tour-guide/fixtures/` — two invented trips on reserved domains (`transit-city`, three TRANSIT days; `driving-loop`, four DRIVE days), eight JSON parts each, a Maps mock responder that replays the Route Matrix and Compute Routes answers, `fixtureTravel` for the expected pair answer
- `helpers/packs/tour-guide/planner/` — `planTrip`, `replanDays`, `estimateBudget`, `PlanBudgetError`, `hoursOn`, `dateRange`: candidates by date, one Route Matrix per day, Held-Karp with time windows / bookings / lunch slot, real legs pair by pair with a re-solve on the real times, Google cross-check, warnings (`hours_unknown`, `tight_connection`, `over_long_day`, `order_disagreement`), Later codes (`too_far`, `closed_business`, `outside_day`, `day_full`), SKU budget checked against the ledger ceiling before any call, deterministic by seed
- `helpers/packs/tour-guide/brochure-map/` — `toBrochureModel`, `renderPlan`, `renderPlanPdf`: Plan → brochure-kit model (days, cards with hours today and one credited review, Later lists, practical blocks, Google attribution) → HTML / PDF
- `helpers/tests/pack_tour-guide_*.test.js` + `pack_tour-guide_planner_world.js` — 58 new tests (206 in the suite, 1 skipped live smoke), including the cross-WP integration test that checks the Phase 3 property set on both fixtures end to end
- `helpers/status/WP-3a.md` … `WP-3c.md`, `helpers/decisions/WP-3a.md` … `WP-3c.md` — per-package status and defaults
- `helpers/decisions/TG-PHASE-3.md` — coordinator defaults, ownership-map extension, solver design and limits, requests carried to later phases
- `helpers/prompts/TG-PHASE-4.md` — Phase 4 kickoff for the brain side in the private repo

### Changed
- `helpers/templates/private-repo/CLAUDE.md` — the memory-directories line no longer double-wraps the rendered list in backticks
- `helpers/tests/tools_bundle.test.js` — asserts the `hello` pack is listed rather than that it is the only pack
- `helpers/BUILD-STATE.md` — Phase 3 done, Phase 3 log, next step (Phase 4)
- `README.md` — tree entries for every new file

## [v01.13r] — 2026-10-01 01:12:03 AM EST

> **Prompt:** "Start phase 2"

### Added
- `helpers/kits/maps/` — Places API (New) + Routes API client: one fixed field mask per SKU tier, a monthly SKU ledger with a hard stop before any call over its ceiling, build-scoped Google snapshots with a terms-driven purge, Google Maps URLs, a zero-dependency transport through the HTTPS proxy tunnel, CLI with `--live` for network calls, fixtures in the real API shapes
- `helpers/kits/research/` — research-run contract: search/fetch/time budgets, a source ledger, the two-independent-sources rule, confidence labels (conflicting, unverified, stale, confirmed, likely, single-source), a prompt-injection scanner for untrusted text, visit-duration ranges, CLI and library
- `helpers/kits/brochure/` — brochure renderer: JSON Schema model → one self-contained HTML document (no script, no network) → paginated PDF through the pre-installed Chromium; cover, trip at a glance, day spreads with a timeline rail and route sketch, place cards, saved-for-later lists, practical notes, Google Maps attribution; Bitstream Charter fonts with their notice; invented sample trip
- `helpers/kits/prefs/` — connector-reader pattern for preferences: evidence → held notes → owner review (✅ / ✏️ / ❌, sized for Telegram) → confirmed profile; travel vocabulary preset
- `helpers/tests/kit_*` — 94 new tests across the four kits (148 in the suite; the live Maps smoke is skipped unless asked)
- `helpers/status/WP-2a.md` … `WP-2d.md`, `helpers/decisions/WP-2a.md` … `WP-2d.md` — per-package status and defaults
- `helpers/decisions/TG-PHASE-2.md` — coordinator defaults, smoke-call findings, brochure rating, requests carried to later phases
- `helpers/prompts/TG-PHASE-3.md` — Phase 3 kickoff for the Tour Guide engine
- `.claude/agents/hb-builder-opus-medium.md` — Opus 5.5 · medium builder for tightly specified work packages

### Changed
- `helpers/SPEC.md` — §16 kit CLI form is `node helpers/kits/<kit>/index.mjs <command>`
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — Phase 2a corrections to facts 2, 7, 10 and 12; Google snapshot content is build-scoped (§4.4, §9)
- `helpers/BUILD-STATE.md` — Phase 2 done, Phase 2 log, next step

## [v01.12r] — 2026-09-30 11:33:51 PM EST

> **Prompt:** "Start Phase 1"

### Added
- `helpers/core/` — generic Apps Script core (15 files) generalized from the first helper after the owner-approved scrub report: config from a pack manifest (`HELPER.*`, prefixed Script Properties, `LIMITS`), extension registries as the only extension point, Sheet store + audit log, Telegram client, queue with one-off worker triggers, executor (proposal → owner ✅ → allowlisted action), Drive mailbox relay, web-app router (`?route=tg|wake|setup`), wake route with no permanent tick, routine fire client, owner setup page
- `helpers/tools/` — `bundle.mjs` (manifest validation, one Apps Script project from core + pack `gas/`, `--check`, `--all`), `envelope.mjs` (same CLI as the first helper, `--pack` adds manifest types), `new-helper.mjs` (scaffolds a pack and a private repo from the template), `boundary-check.mjs` + `boundary-allowlist.txt` (fails on secrets, PII and personal-data paths; CI gate)
- `helpers/templates/private-repo/` — dual-mode `CLAUDE.md`, skills and routines READMEs, trimmed `remember-session` skill, memory dirs, `.gitattributes` union merge, `merge-routine-memory.yml` + script, `DEV-SESSION.md` with the `/update-helpers` pin bump, `vendor/helpers/` first-pin instructions
- `helpers/packs/hello/` — the smallest pack (extra envelope type, command, message handler, snapshot provider, daily job, setup step) that bundles and runs in the mocks
- `helpers/tests/` — 14 `node --test` suites (54 tests) + in-memory Apps Script mocks; the boundary test plants a fake secret and a personal-data path and asserts the check fails
- `helpers/SPEC.md` — framework contract v1 in 18 sections (three homes, envelope v1, mailbox and requests, manifest, registries, routes and wake contract, properties, sheet, triggers, routines, executor, setup page, tools, CI/dist/deploy, vendoring procedure with the measured subtree decision, file-ownership map for Phase 2, how a new helper is added, limits)
- `helpers/README.md` — framework overview, quick start, how to add a helper, the public/private rules
- `.claude/agents/hb-architect.md`, `hb-builder-fable.md`, `hb-builder-opus.md`, `hb-reader.md` — build agents with model, effort and (reader) `disallowedTools`
- `.github/workflows/helpers-ci.yml` (tests + bundle check + boundary check on pushes and PRs touching `helpers/`), `helpers-dist.yml` (publishes `helpers/` as the `helpers-dist` branch after each merge to `main`, via `workflow_run` of the auto-merge workflow), `deploy-helper.yml` (matrix over `helpers/packs/*/helper.json`, test gate, `production` environment on `main` only, `umask 077`, credential cleanup; secrets `CLASPRC_JSON`, `<HELPER>_SCRIPT_ID`, `<HELPER>_DEPLOYMENT_ID` named, not created)
- `helpers/decisions/TG-PHASE-1.md` — scrub report (15 rows, owner-approved), subtree-vs-clone measurement, every default chosen
- `helpers/prompts/TG-PHASE-2.md` — Phase 2 kickoff for the four shared kits and their coordinator

### Changed
- `CLAUDE.md` — three-line routine-mode guard at the very top: a session started by a Claude Code Routine ignores this file and follows the attached helper repo's `CLAUDE.md`
- `.gitignore` — `helpers/dist/` (local bundles)
- `helpers/BUILD-STATE.md` — Phase 1 marked **done**; Phase 1 log; Next points at Phase 2 (new session, Opus 5.5 · high, `helpers/prompts/TG-PHASE-2.md`)
- `repository-information/REPO-ARCHITECTURE.md` — flowchart gains the Helper Framework subgraph (`helpers/`, `hb-*` agents, the three workflows, the `helpers-dist` branch) with edges from the auto-merge flow; mermaid.live URL regenerated and verified
- `README.md` — tree expanded for every file under `helpers/`, the four agent files and the three workflows
- `repository-information/SESSION-CONTEXT.md` — Phase 1 complete; recommendation is to start Phase 2

## [v01.11r] — 2026-09-30 10:05:26 PM EST

> **Prompt:** "1. bot token created for JonTourGuideBot.
> 2. defaults"

### Changed
- `helpers/BUILD-STATE.md` — Phase 0 marked **done** (2026-09-30): bot token created and held by the owner, all thirteen decisions confirmed as defaults; Next now points at Phase 1 (new session, Fable 5.1 · xhigh, `helpers/prompts/TG-PHASE-1.md`)
- `helpers/decisions/TG-PHASE-0.md` — decisions 2–13 moved from "default" to "confirmed"; BotFather action marked done (token and bot name stay out of this repo); header records the Phase 0 close
- `repository-information/SESSION-CONTEXT.md` — Phase 0 complete; recommendation is to start Phase 1

## [v01.10r] — 2026-09-30 09:10:27 PM EST

> **Prompt:** "maps key added"

### Changed
- `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-0.md` — Maps key recorded as added to Claude HQ as an API credential for the Places and Routes hosts with the `X-Goog-Api-Key` header (plan fact 10 inference resolved from the cloud-environments doc: custom header name with an empty prefix is supported); Google Cloud per-API daily caps deferred to Phase 7 because the free trial blocks quota edits; remaining owner actions are the bot token and any objection to the defaults
- `repository-information/SESSION-CONTEXT.md` — updated for the same state

## [v01.09r] — 2026-09-30 08:38:20 PM EST

> **Prompt:** "repo created and added to Tour Guide's project settings"

### Changed
- `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-0.md` — the private `TourGuide` repo is created, attached, verified private and seeded with the §4.2 skeleton on its `main` (owner's choice); decision 1 marked confirmed; remaining owner actions are the Maps key credential, the bot token and any objection to the defaults
- `repository-information/SESSION-CONTEXT.md` — updated for the same state

## [v01.08r] — 2026-09-30 08:20:41 PM EST

> **Prompt:** "Start Phase 0 in a new session on Fable 5.1 High, using the kickoff in section 12 of the plan."

### Added
- `helpers/` — new top-level tree for the reusable helper framework; Phase 0 of the Tour Guide build (Fable 5.1 · High) adds its build-process files only, no code
  - `helpers/BUILD-STATE.md` — phase tracker (repos and environments, the eight phases with model and effort, conventions, Phase 0 log, next step)
  - `helpers/decisions/TG-PHASE-0.md` — all thirteen §10 decisions recorded with their defaults (owner to object), the four owner actions and their status, session-level decisions (decisions presented in one message; `REPO-ARCHITECTURE.md` deferred to Phase 1; private-repo skeleton contents) and what Phase 0 verified
  - `helpers/prompts/TG-PHASE-1.md` — the Phase 1 kickoff prompt (Fable 5.1 · Xhigh): orient, scrub-report owner gate before any Assistant Brain code is copied into this public repo, the foundation deliverables with their contracts, subtree-vs-clone measurement, done-when, repo bookkeeping, Phase 2 hand-off

### Changed
- `README.md` — new "Helper Framework" group in the tree for `helpers/`
- `repository-information/SESSION-CONTEXT.md` — Phase 0 session saved; the private `TourGuide` repo, the Maps key credential and the bot token are the open owner actions
- Findings recorded for the plan: the GitHub integration cannot create repositories (`create_repository` returned 403), so the private repo is owner-created (plan fact 14 resolved)

## [v01.07r] — 2026-09-30 07:55:53 PM EST

> **Prompt:** "why is the plan phase being done on Opus 5.5 Medium? Isn't this one of the most important phases? Shouldn't it be Fable 5.1 xhigh?"
>
> Project topic: "Create a helper that can understand my preferences (by reading everything from approved connectors), conduct deep web research (without requiring me to always give approval to continue), check how long an average tourist spends at a certain location, use google maps to optimize routes between points of interests, create lists to save unused but researched points of interest for later, write detailed personalized notes for each location, then use all that information to craft and recommend detailed action plans for each day that include general info (address, hours of operation, days closed, google reviews/stars, website), expected amount of time to spend doing [insert activities here], expected amount of time going from location to location via [insert optimal google map plan here], with some free time sprinkled here and there. The final output should be look like a beautiful travel brochure that took a travel agency's entire marketing & design team to create over months of work. I also want a chatbot that I can interact with in a similar manner to my Chief of Staff helper (Assistant Brain). However, I want this infrastructure to be implemented in my Personal repository, so I can build other helpers later."

### Changed
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — replaced the v01.06r draft (written on Opus 5.5 · Medium) with a plan authored on Fable 5.1 · Xhigh. One plan remains at the same path; nothing is built yet
  - Every web fact re-checked on official pages: Enterprise Place Details corrected to $20 per 1,000 ($25 is Enterprise + Atmosphere); Route Matrix supports `TRANSIT` with a 100-element cap; `optimizeWaypointOrder` caps at 25 stops and transit takes no intermediate waypoints; no Google API exposes visit duration; the 30-day coordinate-caching clause is marked as an inference to verify; routine limits, `/fire` header and Artifact republish rules cited; Google's Grounding Lite Maps MCP noted as an optional spike
  - Chatbot redesigned as three lanes: instant Apps Script commands, an optional fast Claude API lane (off by default), and deep routine runs fed by request envelopes with a wake route instead of a polling tick, so it adds no trigger minutes next to Assistant Brain's
  - Routines attach only the private helper repo (tools vendored from a `helpers-dist` branch) so this repo's development `CLAUDE.md` never loads in a routine; a routine-mode guard is added here as a backstop
  - Reuse made explicit: the deploy workflow grows from this repo's clasp pilot plus Assistant Brain's deploy workflow; the auto-merge workflow is untouched; the Pages sign-in machinery is not used because the Tour Guide has no public page
  - Assistant Brain's build process imported: per-role agent files with model and effort, per-phase prompt files, decisions and status per work package, worktrees, a build tracker, and session-context files in both repos
  - Model and effort per phase: Phase 0 Fable 5.1 · High (was Opus 5.5 · Medium); foundation and integration Fable 5.1 · Xhigh; solver, brochure design and the two core research/planning skills Fable 5.1 · High; other building Opus 5.5 · High or Medium
  - Chromium for brochure PDFs is pre-installed in this environment's image (checked on the machine), with a Phase 2c check inside a routine run
  - Thirteen owner decisions with defaults, and a Phase 0 kickoff on Fable 5.1 · High
- `README.md` — tree description for the plan updated

## [v01.06r] — 2026-09-30 07:30:47 PM EST

> **Prompt:** "Help me set up this new project from my recent work. Look through my recent sessions and repositories, identify the main thread of work, and propose a project setup: a short name, the repositories it should include, an environment, concise project instructions drawn from what kept coming up, and one or two optional routines. Show me the proposal before changing anything."
>
> "Ok, then I have set the environment to Claude HQ. Go ahead."

### Added
- `repository-information/TOUR-GUIDE-BUILD-PLAN.md` — phased build plan for the Tour Guide helper (the "Tour Guide" project) and the reusable helper framework it sits on. Plan only; nothing built.
  - Public/private split: framework, kits and generic Tour Guide code go under a new `helpers/` tree in this public repo; persona, skills, memory and all trip data go in a new private `LightAISolutions/TourGuide` repo and the owner's Drive; a CI boundary check enforces it
  - Reuses Assistant Brain patterns (two lanes, Drive mailbox + envelope tool, Telegram core, registries, routines, quarantine, memory-merge workflow) without modifying Assistant Brain
  - Platform facts verified on the web 2026-09-30: no official API for "typical time spent" (estimated by research instead); hours/rating/website are Place Details Enterprise fields; free monthly caps 10k/5k/1k per tier; waypoint optimization not available for transit; Places content caching limits; Apps Script Maps service 1,000 queries/day and the shared 90 min/day trigger runtime; routines have hourly (not daily) run limits and keys belong in environment API credentials
  - Phases 0–8 with model and effort per phase (Fable 5.1 · Xhigh for framework foundation and integration; Fable 5.1 · High for the route solver and brochure design; Opus 5.5 · High/Medium for kits, skills and the chatbot), owner actions, done criteria and a finish-priority order
  - Environment notes: Claude HQ runs the build and the routines; the Maps key goes in as an API credential in Phase 0; live Google calls only in Phases 2a, 7 and 8
  - Eight owner decisions with recommended defaults
- `README.md` — tree entry for the new plan

## [v01.05r] — 2026-09-29 07:17:22 AM EST

> **Prompt:** "Save down in potential future projects, in order of interest:
>
> * Personal knowledge wiki
> * Career system: job scanning, tailorer resumes
> * Ask about Simon Willison's 234 small single-page tools to draw inspiration
> * Windows power-user kit
> * Health coach from wearable data once I actually own and use one"

### Added
- `repository-information/FUTURE-CONSIDERATIONS.md` — new "Potential Future Projects (in order of interest)" section listing the owner's five candidate projects, each with a one-line description (drawn from the 2026-09-25 research on what people build with Claude Code) and a trigger condition:
  1. personal knowledge wiki
  2. career system (job scanning + tailored résumés)
  3. a Claude survey of Simon Willison's single-page tools for inspiration
  4. Windows power-user kit
  5. health coach from wearable data, once a wearable is owned and used
  
  The file's intro line was broadened to cover potential future projects.

## [v01.04r] — 2026-09-25 07:35:40 PM EST

> **Prompt:** "Two stale references were found in the `LightAISolutions/Personal` repo while researching a personal-assistant project. Verify each one, then fix it.
>
> ## 1. `autoHotkey/AutoUpdate.ahk` points at the template repo
>
> Lines ~12–19 currently read:
>
> ```
> GITHUB_OWNER  := "LightAISolutions"
> GITHUB_REPO   := "lightaisolutions"
> ...
> PAGES_BASE    := "https://" GITHUB_OWNER ".github.io/" GITHUB_REPO "/"
> API_BASE      := "https://api.github.com/repos/" GITHUB_OWNER "/" GITHUB_REPO
> ```
>
> `lightaisolutions` is the template repo's name, so the updater polls `LightAISolutions.github.io/lightaisolutions/` and the template's GitHub API instead of this repo (`LightAISolutions/Personal`, Pages at `lightaisolutions.github.io/Personal/`). A previous session (v01.00r) converted this repo from a "Sales" copy and re-scoped identity references to `LightAISolutions/Personal`, and this constant appears to have been missed.
>
> - **First confirm it isn't intentional.** Check `git log -p -- autoHotkey/AutoUpdate.ahk`, `autoHotkey/auto-update-targets.ini`, `live-site-pages/ahk-versions/`, `live-site-pages/auto-update-html-versions/`, and the CHANGELOG. If the updater is meant to pull from the template, document that instead of changing it.
> - **If it is a bug**, set `GITHUB_REPO := "Personal"`. Also grep the rest of `autoHotkey/` and `scripts/init-repo.sh` for any other stale `lightaisolutions` repo-name references that should now be `Personal`.
> - Follow the repo's CLAUDE.md Pre-Commit Checklist:
>   - **[PC-GS-VERSION] #1 (AHK part):** bump the `VERSION` constant in the `.ahk`. Do **not** hand-edit `ahk-versions/*.txt`; CI regenerates it.
>   - Add an AHK changelog entry per `.claude/rules/changelogs.md`. It is public-facing, so no file or function names.
>   - Add a repo CHANGELOG entry.
>   - Update the README tree label if the file's label changes.
>
> ## 2. `repository-information/FUTURE-CONSIDERATIONS.md` quota line is wrong
>
> Line ~18 says `Consumer account: 20,000 script executions/day shared across ALL scripts`. Per Google's quota page (https://developers.google.com/apps-script/guides/services/quotas), 20,000/day is the **UrlFetch calls** quota for consumer accounts. The daily limit that actually applies to triggers is **90 minutes/day of total trigger runtime** (6 h on Workspace), with a 6-minute cap per execution. Correct the line (and the Workspace line after it), citing the source. Check `repository-information/DATA-POLL-ARCHITECTURE.md` for the same mistake.
>
> ## Done when
> - The updater targets the right repo, or its intent is documented.
> - The quota lines are accurate.
> - Standard pre-commit items (versions, changelogs, README timestamp) are handled in a single commit, pushed to the session's `claude/*` branch."

### Fixed
- `autoHotkey/AutoUpdate.ahk` (v01.01a) — `GITHUB_REPO` changed from `"lightaisolutions"` (the template repo) to `"Personal"`. `PAGES_BASE` and `API_BASE` are built from it, so the updater had been polling the template's GitHub Pages version files and downloading from the template's contents API instead of this repo's.
  - Confirmed as a bug, not intent: the repo-tracked manifest `auto-update-targets.ini` and `live-site-pages/ahk-versions/` list this repo's own scripts.
  - The value dates to the initial (Sales-copy) commit; the v01.00r re-scope touched only `VERSION` in this file.
  - Root cause: `scripts/init-repo.sh`'s `REPLACE_FILES` list omits `autoHotkey/AutoUpdate.ahk`, so initialization never rewrites it. `OLD_REPO="lightaisolutions"` in that script is the intended search pattern, not a stale reference.
  - No other stale repo-name references exist in `autoHotkey/` or `scripts/init-repo.sh`.
  - `live-site-pages/ahk-versions/autoupdateahk.version.txt` is left for CI to regenerate.
- `repository-information/FUTURE-CONSIDERATIONS.md` — the Reference section called 20,000 / 100,000 per day a "script executions" quota; those are the **UrlFetch calls** quotas. It now lists the real limits, verified against Google's quota page (updated 2026-09-03):
  - 90 min/day (consumer) / 6 hr/day (Workspace) total trigger runtime
  - 6 min per execution
  - 30 simultaneous executions per user
  - no published daily cap on total executions
  
  `repository-information/DATA-POLL-ARCHITECTURE.md` was checked and already states these limits correctly.

### Changed
- `README.md` — `FUTURE-CONSIDERATIONS.md` tree label `[template]` → `[template · modified]`

## [v01.03r] — 2026-09-25 07:29:06 PM EST

> **Prompt:** "I like the idea of having a personal assistant AI and I'm sure many others have already built their own versions. Conduct deep research into what this landscape looks like, what my big-picture options are, what functions are most useful and feasible to build, and recommend me some directions to move towards. I will likely use this project to dump extra tokens/usage into near my weekly reset, so feel free to think big. You will have a large budget to work with."

### Added
- `repository-information/PERSONAL-ASSISTANT-RESEARCH.md` — landscape research (as of 2026-09-25) for building a personal assistant AI, synthesized from six parallel research passes:
  - commercial assistants and what changed in 2026 (Pulse/Atlas/Mariner shutdowns, free Gemini Daily Brief, cloud background agents)
  - the open-source "claw" family (OpenClaw architecture, security record, alternatives)
  - the "Claude Code as personal OS" pattern
  - Claude subscription mechanics and automation rules (which surfaces spare weekly usage can legitimately power; the 2026 third-party-harness policy timeline; Routines details verified against the docs)
  - memory, channel, voice, hosting and local-model building blocks
  - agent security incidents and a two-lane defensive architecture
  - a scored use-case catalog
  - feasibility limits of this repo's Apps Script + GitHub stack — including the finding that this repo is **public**, so personal data and memory must live elsewhere
- `repository-information/PERSONAL-ASSISTANT-ROADMAP.md` — recommendations built on that research:
  - a five-option comparison, recommending a hybrid: a Claude-Code-native brain (private repo + Routines on the subscription) plus a separate Apps Script + Telegram always-on layer
  - design principles
  - a reference architecture with a Mermaid diagram and data flows
  - a tiered function catalog led by an obligations ledger + morning brief
  - an 8-phase roadmap with checkbox tasks and exit criteria
  - a token-dump playbook for spending spare weekly usage on durable outputs (backfills, eval sets, dossiers)
  - a risk register and the open decisions only the developer can make

### Changed
- `README.md` — structure tree lists the two new documents

## [v01.02r] — 2026-08-30 03:02:03 AM EST

> **Prompt:** "deployment branches updated — verify the auto-deploy"

### Changed
- `live-site-pages/.deploy-trigger` — touched to force a Pages redeploy and exercise the full automatic chain (push to `claude/*` → auto-merge → deploy) end-to-end, verifying that the `github-pages` environment's deployment-branch policy now admits `claude/*` refs. The prior run's `deploy` job was rejected at job level (zero steps, no logs) because enabling Pages created the environment with its default default-branch-only policy, which made the merge succeed while publishing silently failed

## [v01.01r] — 2026-08-30 02:55:41 AM EST

> **Prompt:** "Skip Step 2 and let me trigger the deploy instead"

### Fixed
- `live-site-pages/index.html` — the landing page's `<title>` still carried the template placeholder `CHANGE THIS PROJECT TITLE TEMPLATE`, which was visible in the browser tab on the newly-published live site; resolved to the `YOUR_PROJECT_TITLE` value (`Personal`). Found while verifying the first successful GitHub Pages deployment. The copies in `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and the placeholder check in `scripts/setup-gas-project.sh` are intentionally left as-is — the template must keep the placeholder for new pages to substitute, and the script greps for it as an unresolved-placeholder guard
