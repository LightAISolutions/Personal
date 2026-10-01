# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with project-specific versioning (`w` = website, `g` = Google Apps Script, `r` = repository). Older sections are rotated to [CHANGELOG-archive.md](CHANGELOG-archive.md) when this file exceeds 100 version sections.

`Sections: 9/100`

## [Unreleased]

*(No changes yet)*

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
