# {{DISPLAY_NAME}} (private)

The private home of the **{{DISPLAY_NAME}}** helper: the routine-mode `CLAUDE.md`, the skills its Claude Code Routines run, the owner-confirmed memory, quarantine notes and daily logs, the routine prompt texts, and a pinned copy of the shared framework. Everything in Google Drive lives under `{{DRIVE_ROOT}}/` (mailbox, state, documents); everything in git lives here.

A helper is a personal Telegram chatbot. Its **core** is a Google Apps Script web app built from the public framework repo `{{FRAMEWORK_REPO}}` (directory `helpers/`: core, tools, kits and the pack `packs/{{HELPER_NAME}}/`). Its **brain** is a set of Claude Code Routines that run with this private repo attached. Core and brain talk only through the Drive mailbox (`{{DRIVE_ROOT}}/mailbox/`) and the core's wake route; the contract is `vendor/helpers/SPEC.md` once the framework is pinned.

This repository was created from `helpers/templates/private-repo/` in the framework repo by `node helpers/tools/new-helper.mjs`.

## Layout

```
CLAUDE.md                  dual-mode: ROUTINE MODE (persona, two-lane rules, mailbox protocol, memory) / development
skills/<name>/SKILL.md     one playbook per routine (skills/README.md); skills/remember-session/ is for development sessions
routines/<name>.prompt.md  the exact text pasted into the claude.ai routine editor, one per routine (routines/README.md)
{{MEMORY_DIRS}}            the pack's memory directories: owner-confirmed or owner-requested notes only
quarantine/                notes derived from untrusted content, waiting for the owner to promote them
log/                       append-only daily logs, one line per routine run
vendor/helpers/            pinned copy of {{FRAMEWORK_REPO}} → helpers/ (helpers-dist branch); never edited here
scripts/                   merge-routine-memory.sh (run by the memory workflow) · merge-maps-ledger.mjs (git merge driver that sums both sides of log/maps-usage-ledger.json)
.github/workflows/         merge-routine-memory.yml: merges memory-only claude/* branches into main
repository-information/    DEV-SESSION.md (development rules) · SESSION-CONTEXT.md (saved by remember-session) · BUILD-STATE.md (pointer)
```

## Where the framework lives

All shared code is in `{{FRAMEWORK_REPO}}` under `helpers/` and is published from there as the `helpers-dist` branch after every merge to `main`. This repo pins that branch at `vendor/helpers/` with `git subtree` (first pin and updates: `vendor/helpers/README.md`). Routines use the framework from the pin only and never update it; a development session bumps the pin with the `/update-helpers` procedure in `repository-information/DEV-SESSION.md`, reviewing the diff before it lands. Changes to the framework are made in the public repo, never here.

Build plan and progress: `{{FRAMEWORK_REPO}}` → `helpers/BUILD-STATE.md` (`repository-information/BUILD-STATE.md` here only points there).

## Private, but still no secrets

This repository is private because it holds the owner's memory. It still never holds secrets: the bot token, the admin secret, API keys and the routine fire URLs and tokens live only in the Apps Script project's Script Properties and in the Claude environment's API credentials. Nothing in this repo needs them — routines reach Drive, Gmail and Calendar through connectors and reach the core only through the unauthenticated wake route. If a secret is ever pasted into a session, it is not written anywhere.

## Branches

- Routine runs push to their own `claude/*` branch. `merge-routine-memory.yml` merges a branch into `main` when every changed path is a memory path (`log/`, `quarantine/`, `{{MEMORY_DIRS}}`) and deletes it afterwards.
- Development sessions push to their own `claude/*` branch; the owner merges those.
- `main` is never pushed to directly.

Developed by: LightAISolutions
