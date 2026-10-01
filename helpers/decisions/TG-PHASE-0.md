# Phase 0 — Setup and decisions (Tour Guide build)

> Session: Tour Guide project thread, Claude HQ environment, **Fable 5.1 · effort high**, 2026-09-30 (EST). Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` v01.07r, kickoff §12.
> Status key: **default** = the plan's default is assumed because the owner did not object; **confirmed** = the owner said so; **changed** = the owner chose otherwise (the choice is written in the row).
> This file is public. It names no trip, place, person or account.

## 1. The thirteen §10 decisions

| # | Decision | Chosen | Status | Notes |
|---|---|---|---|---|
| 1 | Private repo | `LightAISolutions/TourGuide`, **created by the owner**, one private repo per helper from `helpers/templates/private-repo/` | default (owner action open) | The GitHub connector's `create_repository` returned `403 Resource not accessible by integration` this session, so the session cannot create it (fact 14 resolved: the integration cannot create repos). The owner creates it, attaches it to the Tour Guide project, and the session verifies it is private before pushing the §4.2 skeleton |
| 2 | Separate Telegram bot | Yes, a dedicated Tour Guide bot with its own pairing | default | Token stays with the owner until Phase 7; it is never pasted into a session or a repo |
| 3 | Seed preferences from Assistant Brain's profile | Yes, travel-relevant lines only, once, confirmed line by line in Telegram | default | Runs inside `prefs-build` (Phase 4/7); Assistant Brain itself is not modified |
| 4 | Google Maps Takeout import | Yes, once, in Phase 7 | default | Export dropped into Drive by the owner; no connector reaches it |
| 5 | Brochure delivery | HTML + PDF in Drive, plus one private Artifact per trip published by the owner in Phase 7 and refreshed by `brochure-build` | default | Artifact must stay a single self-contained page (fact 9) |
| 6 | Lane B fast chat via the Claude API | Built in Phase 5 behind `CHAT_API_ENABLED=false`; switched on only if Phase 8 shows Lane C is too slow | default | Paid per token outside the subscription |
| 7 | How the private repo gets the tools | `git subtree` pin of the `helpers-dist` branch at `vendor/helpers/`; Phase 1 measures clone-at-run and may switch | default | |
| 8 | Grounding Lite MCP spike | Yes, in Phase 2a, time-boxed to one session; never replaces the Places/Routes client | default | |
| 9 | Migrate Assistant Brain onto the framework | Not in this build; decide after the Tour Guide has run for a few weeks | default | |
| 10 | Separate "TG routines" environment | No; routines run in Claude HQ; revisit in Phase 8 | default | |
| 11 | Routine models | Opus 5.5 everywhere; Fable 5.1 for `trip-research` on trips that matter | default | Set per routine in the claude.ai editor in Phase 7 (model selector, no effort control) |
| 12 | Third-party visit-duration scraper | Off; research triangulation is the source | default | |
| 13 | Pilot trip for Phase 7 | Owner's pick at Phase 7: the next real trip, or a sample city if none is planned | default (owner picks later) | The trip is never named in this repo |

## 2. Owner actions from the Phase 0 row of §6

| Action | Status | Where it is checked |
|---|---|---|
| Create private `LightAISolutions/TourGuide` and attach it to the Tour Guide project | **open** — the session asked for it (connector cannot create repos) | This session verifies visibility, then pushes the §4.2 skeleton |
| Google Cloud project with **Places API (New)** and **Routes API** enabled; key restricted to those two APIs; per-API daily caps; budget alert | **open** — owner confirms | Phase 2a live smoke calls |
| Add the key to Claude HQ as an **API credential** for hosts `places.googleapis.com` and `routes.googleapis.com`, header `X-Goog-Api-Key` if the dialog allows it | **open** — owner confirms, and reports whether the header type could be chosen (fact 10 inference) | Phase 2a. A probe from this session was not run: the sandbox's auto-mode classifier blocked an unauthenticated test call to the Maps hosts as credential exploration, so the header-type question is answered by the owner's dialog and verified live in Phase 2a |
| BotFather → new bot token | **open** — owner creates it and keeps it for Phase 7 | Phase 7 switch-on |

## 3. Session decisions (not in §10)

- **Decisions were presented in one message, not one at a time.** The kickoff says "one at a time (defaults unless I object)"; in a project thread each round trip can wait hours, so all thirteen were listed in a single reply with the default marked, and the build assumes the defaults until the owner objects. Any objection is recorded here as **changed** by the session that receives it.
- **Phase 0 writes only the three files the plan names** (`helpers/BUILD-STATE.md`, this file, `helpers/prompts/TG-PHASE-1.md`) plus the repo's bookkeeping (CHANGELOG, README tree and timestamp, version, session context). `helpers/README.md`, `helpers/SPEC.md` and all code are Phase 1 work and were not started.
- **`REPO-ARCHITECTURE.md` is not updated in Phase 0.** The new `helpers/` tree holds only build-process files so far; the architecture diagram gets its `helpers/` node in Phase 1 when the framework, workflows and the `helpers-dist` branch exist (the mermaid URL is regenerated once, not twice).
- **Private-repo skeleton** (§4.2) is prepared by this session and pushed as the repo's first commit once the owner has created the repo and the session has confirmed it is private: `README.md`, a dual-mode `CLAUDE.md` stub (routine mode says "not configured yet, do nothing"; development mode points at `repository-information/DEV-SESSION.md`), `.gitattributes` with `log/*.md merge=union`, `.gitignore`, empty `skills/ profile/ trips/ places/ quarantine/ log/ routines/ vendor/helpers/`, and `repository-information/{SESSION-CONTEXT.md,BUILD-STATE.md}`. Phase 1's `templates/private-repo/` replaces the stub files; Phase 4 writes the real persona and skills. The private repo's `BUILD-STATE.md` only points at this repo's `helpers/BUILD-STATE.md` so there is one tracker.
- **Phase 1 runs in this repo under this repo's conventions**: one `claude/*` branch, one push per interaction through `auto-merge-claude.yml`, version bump + CHANGELOG + README tree + `remember-session` per the Pre-Commit and Pre-Push checklists. AB's worktree-per-work-package pattern starts in Phase 2, where work is parallel; Phase 1 is a single architect session.

## 4. What Phase 0 verified or learned

- `LightAISolutions/TourGuide` did not exist on 2026-09-30 (checked through the session's repo listing); the GitHub integration cannot create repositories (403 on `create_repository`).
- `LightAISolutions/Personal` is public and `AssistantBrain` is private (same listing). Environments available: Claude HQ (this project), AB build, AB routines (both untouched).
- Chromium is pre-installed in this image (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), as the plan's fact 10 records; nothing else from §3 was re-checked in Phase 0.
- Assistant Brain's build files were read for shape only (`BUILD-STATE.md`, `prompts/PHASE-1.md`, `decisions/PHASE-1.md`, `.claude/agents/ab-architect.md`, `docs/DEV-SESSION.md`, `.gitattributes`, `merge-routine-memory.yml`); nothing in AssistantBrain was changed.

Developed by: LightAISolutions
