# Phase 6 — Integration, red-team and the switch-on guide

> Start this in a **new session** on **Fable 5.1 · effort xhigh** with the prompt: `Read helpers/prompts/TG-PHASE-6.md and execute it exactly.`
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` §6 row 6, §5.8–§5.11, §8 (risks), §10 decisions 6, 19, 22–26. Written 2026-10-01 by Phase 5 (`helpers/decisions/TG-PHASE-5.md`). Progress in `helpers/BUILD-STATE.md`.

You are the **architect** for Phase 6 of the Tour Guide build. Phases 0–5 built the framework core, the kits, the engine, the brain skills in the private repo and the Telegram chatbot pack — each tested in isolation and through the Apps Script mocks. This phase proves the whole thing holds together across both repos, attacks it the way untrusted content would, checks what it costs, and writes the guide the owner follows to switch it on in Phase 7. You may fan out builders in worktrees (`hb-builder-opus` for well-specified fixes, `hb-builder-fable` for judgment-heavy ones) and own the merges, the bookkeeping and the single push. Record every default you pick in `helpers/decisions/TG-PHASE-6.md`. Ask the owner only when a finding needs their decision; keep doing everything that does not depend on the answer.

## Carried from Phase 5 (details: `helpers/decisions/TG-PHASE-5.md` §2–§5)
| # | Item | What Phase 6 does |
|---|---|---|
| 1 | **Lane B is a toggle** (owner, 2026-10-01): free routines (Lane C) by default; `/smart on\|off` turns on direct Claude API answers when `CLAUDE_API_KEY` is set; `/status` shows the mode | Red-team Lane B (chat text, `/smart`, the usage counter, the daily cap `CHAT_API_MAX_PER_DAY`); put the toggle, its cost and the key in the switch-on guide; verify the default model id and per-token prices against Anthropic's current docs (web search, cite) |
| 2 | **Review decisions path**: `pf:` taps → a `prefs` request with `payload.decisions` → `prefs-build-ingest.mjs --decisions` (private repo PR #3 on branch `claude/project-thread-m0kbpq`) | Confirm the owner merged PR #3; if not, read the skill from that branch and say so in the guide's prerequisites |
| 3 | `MAX_ROUTINE_FIRES_PER_DAY` default 12 is tight (a full `/plan` uses 4–6 fires) | Decide the recommended value (WP-5c suggests 20–24) and write it in the guide |
| 4 | WP-4d R2 (`floor_reason` on the shortlist) not adopted; R3 (`gem_line` rating digits) rendered as the brain writes them | Decide R3 in the Google terms review below; R2 only if the red-team shows the owner needs it |
| 5 | Trigger minutes measured in the mocks (`helpers/decisions/WP-5c.md` §M): a `/plan` ≈ 45 s, a typical day 0.5–1.5 of 90 minutes | Re-check against Apps Script's documented quotas (web search, official page) in the cost audit |
| 6 | The private repo pins `vendor/helpers/` to the v01.25r `helpers-dist` | Re-pin to the Phase 5 dist (`/update-helpers`, `vendor/helpers/README.md`) on a `claude/*` branch, run its journey dry run, hand the branch to the owner as a PR |

## Step 0 — Orient
Read `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-5.md`, `helpers/decisions/WP-5{a,b,c}.md`, `helpers/status/WP-5{a,b,c}.md`, `helpers/SPEC.md`, the pack README (`helpers/packs/tour-guide/README.md`, section Chatbot) and, in the private repo (`LightAISolutions/TourGuide`, reference for reading; changes only on a `claude/*` branch, never `main`), `CLAUDE.md`, `routines/README.md`, `skills/README.md` and `tools/journey-dryrun.mjs`. Run the three checks (`node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check`, `node helpers/tools/boundary-check.mjs`) and the private repo's journey dry run; record the baseline.

## Step 1 — Integration across both repos
Join the halves that were only tested apart: feed the envelopes the private repo's journey dry run writes (`trip_facts`, `shortlist`, `plan_digest`, `prefs_review`, `profile_summary`, `places_digest`, `reply`) into the core's mock mailbox and run them through the pack's handlers, and feed the requests the pack writes (`research`, `plan`, `replan`, `notes`, `brochure`, `prefs` with `interview` / `review` / `decisions`, `places`, `message`) into the skills' drivers. Every field one side writes must be one the other side reads with the same meaning; fix the side that is wrong (private-repo fixes go on its `claude/*` branch). Add the joined run as a test or a dry-run script that runs on invented fixtures only.

## Step 2 — Red-team (prompt injection and untrusted text)
Attack every path where text the owner did not write reaches the profile, a shortlist line, a chat message or a routine's instructions: research pages, local-language source pages and the "why it's a gem" lines (a page must not be able to buy itself a 💎), place notes, chat messages in both lanes, **the interview's free-text answers**, **the shortlist**, **`/places` output** (names and note lines come from the brain and must arrive escaped), envelope payloads (oversize, wrong types, Google fields, HTML), callback data and fire text. For each: a concrete attack fixture (invented), the expected refusal or neutralisation, and a test. Page text must never reach the profile or a shortlist line — the brain's own wording only. Fix what fails; list what is accepted risk with the reason.

## Step 3 — PDF delivery and the size fallback
Prove the brochure PDF reaches the chat as a document within Telegram's limit, that an oversize file falls back to a link the owner can open, and that a resend (📄 button, `/brochure`) never re-runs the build.

## Step 4 — Cost and quota audit
One table: Google Maps SKUs per research round and per plan (the Maps kit ledger), Places Aggregate, Claude API spend under Lane B at the default model and the daily cap, routine fires per day and their cap, Apps Script trigger minutes, UrlFetch calls and Drive operations against their documented quotas. **Verify every quota, limit and price with a web search against the official page and cite it** — never from memory. Say what a typical week of use costs and what stops runaway spend.

## Step 5 — The switch-on guide
Write `helpers/docs/TG-SWITCH-ON.md` for the owner (plain steps, no personal data): deploy the core with `deploy-helper.yml`, every Script Property (required / optional, which are secrets), pairing the bot, creating the seven routines in the claude.ai editor (`CRON_TZ=` the owner's zone, models per the plan's table), **the interview as the first thing after pairing**, reviewing its free-text candidates, a `/plan` walkthrough for a real trip (what each message and button means), `/smart` and what it costs, and how to tell when something is stuck (`/status`, `/pending`, the wake route). Phase 7 then runs the live interview with the owner from this guide.

## Step 6 — Done when
All suites green in both repos; every red-team finding fixed with a test or listed as accepted with its reason; the cost table cited; the guide complete; no personal data and no keys in this repo.

## Step 7 — Bookkeeping and hand-off
This repo's `CLAUDE.md` push-commit rules (version bump, CHANGELOG section with the verbatim prompt, README tree for new files, README timestamp, Developed-by line on new files). Write `helpers/decisions/TG-PHASE-6.md`, update `helpers/BUILD-STATE.md` (Phase 6 done, log, Next), and write `helpers/prompts/TG-PHASE-7.md` — the owner switch-on (plan §6 row 7, interactive, about 90 minutes) on the model the plan names. `helpers/prompts/TG-PHASE-9.md` (the Tour Guide app, plan §5.11) stays a **draft that Phase 8 finalizes**: the owner chose the app after the pilot (decision 19, 2026-10-01). Only if the owner pulls the app forward before Phase 7 does Phase 6 fill its FINALIZE block and red-team the app route and shell too. Then run `remember session`, push, and tell the owner: "Phase 6 done. Start a new session on <model> and paste: `Read helpers/prompts/TG-PHASE-7.md and execute it exactly.`"

## Rules
- Public repo: never commit ids, secrets, e-mail addresses, phone numbers, names, trip or place data of the owner's, or anything from the private repo. Attack fixtures and transcripts are invented.
- Live calls only where a step needs a documented fact (web search for quotas and prices); no live Telegram, Drive mailbox, Claude API, wake-route call and no routine creation — those are Phase 7's, with the owner.
- The private repo changes only on a `claude/*` branch the owner merges by PR; never push to its `main`. AssistantBrain is reference only.
- Never edit `.github/workflows/auto-merge-claude.yml`, `scripts/setup-gas-project.sh` or the GlobalACL / MasterACL machinery.
- If a usage limit pauses the session, leave `helpers/BUILD-STATE.md` and a resume note accurate and resume from this prompt.

Developed by: LightAISolutions
