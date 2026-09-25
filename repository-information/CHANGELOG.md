# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with project-specific versioning (`w` = website, `g` = Google Apps Script, `r` = repository). Older sections are rotated to [CHANGELOG-archive.md](CHANGELOG-archive.md) when this file exceeds 100 version sections.

`Sections: 4/100`

## [Unreleased]

*(No changes yet)*

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
