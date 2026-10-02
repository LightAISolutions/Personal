# Phase 8 — Live review and tuning

> Start this in a **new session** on **Opus 5.5 · effort high** with the prompt: `Read helpers/prompts/TG-PHASE-8.md and execute it exactly.` A brochure design pass runs on **Fable 5.1 · high** only if the owner asks for one.
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` §6 row 8, §5.5–§5.9, §10 decisions 6, 10, 11, 22–26. Written 2026-10-02 by Phase 7. Progress in `helpers/BUILD-STATE.md`. **Starts after the owner's pilot trip** — the owner has travelled with the pilot brochure and can say what worked.

You are the **reviewer and tuner** for Phase 8 of the Tour Guide build. Phase 7 switched everything on for the owner and ran one real trip through `/plan`. Phase 9 (the Tour Guide app) was pulled forward by the owner during Phase 7 and is done (v01.39r), so this phase also takes the Phase 9 follow-ups. Everything below is evidence from real use; tune against it, not against fixtures alone.

`Personal`'s `CLAUDE.md` applies in full (session checklist, one push per interaction, push only to this session's `claude/*` branch and wait for it to vanish from the remote before pushing again). `TourGuide` changes only on a `claude/*` branch the owner merges by PR; never edit its `vendor/helpers/` by hand (re-pin with `/update-helpers`).

## Step 0 — Orient
1. Read `CLAUDE.md`, `helpers/BUILD-STATE.md`, `repository-information/SESSION-CONTEXT.md`, `helpers/decisions/TG-PHASE-7.md` (every finding F1–F23 and §2 choices), `helpers/decisions/TG-PHASE-9.md` §6–§7, `helpers/decisions/TG-PHASE-6.md` §3 (costs and quotas), and `helpers/docs/TG-SWITCH-ON.md`.
2. In the private repo read the pilot trip's memory, `log/` since 2026-10-01 and the AuditLog the owner can export (ask; never ask for ids or secrets in the chat).
3. Ask the owner, in one message, how the trip went: which days worked, which estimates were wrong (visit lengths, transit legs), which picks they skipped on the day and why, and what they wished the brochure had.

## Step 1 — Owner questions (ask once, in one message, with defaults)
Use `ask_decision`-style choices if the surface offers them; otherwise a short message with one line per option and the default marked. Keep building with the default while you wait.
1. **Japan train estimates** (carried since 2026-10-01, `decisions/WP-4d.md` P2): how did the Google-based station estimates (`planner-rail.mjs`) feel on the trip? Ekispert's paid timetable service is the named upgrade. Default: keep the estimates.
2. **`show_google_content`** (Phase 6 carry, `decisions/TG-PHASE-6.md` C6): may the brochure and chat show Google hours, ratings and review counts? Default: yes, with attribution, as built.
3. **Lane B `/smart`** (decision 6): the owner's Phase 7 choice is in `decisions/TG-PHASE-7.md` §2. If the free `chat` routine felt too slow on the trip, offer `/smart` again with the per-answer cost from `TG-PHASE-6.md` §3.2. Default: the Phase 7 choice stands.
4. **Routine models** (F23, decision 11): the routines were saved with no model and ran on the service default. Ask whether to set Opus 5.5 in the routine editor (owner's step) or keep the default after seeing the pilot's quality. Default: the owner's Phase 7 answer.
5. **Third-party review sources** (decisions 22, 25): only if the pilot's local-source stream was thin. Default: none.
6. **Other travellers' profiles** (Phase 9 §7.1): who travels with the owner and whose tastes should count. Default: owner only until the slot below exists.

## Step 2 — Carried findings to fix
Each is a live finding from Phase 7 with a proposed fix. Fix, test, push; re-pin the private repo once at the end.
1. **Typed numbers reach only the newest round** (pack `12_flow_plan.js`, `tgPlanApplyPicks`): after a *More* round the owner could not mark a round-1 place by typing. Add round-prefixed numbers (for example `r1 5`) and say so in the choose prompt; keep plain numbers on the newest round.
2. **The app's Shortlist shows only the newest round** (pack `32_app_api.js` `shortlist.get` + the shell): show every round of the open choose flow, newest first, each tap going to its own round.
3. **Trip dates live only in `trips/<slug>.md`**: the planner reads dates, `day_start` and `day_end` from the trip file, so a change the owner states in chat (the pilot cut two days to one) needed a hand-made private-repo PR. Give the plan request the confirmed facts (dates, first-day start, last-day end) and have `plan-days` write them to the trip file before planning, or add a chat path to edit them; the owner should never need a PR to change a date.
4. **`/repick` UX** (F20): it reopens choosing with the old taps; the owner expected suggested picks to be pre-marked when Claude proposed them. Consider a `repick` that accepts a typed list in the same message (`/repick 2 6 7 9`).
5. **The upload key on the command line** (F22): `tools/upload.mjs --key-from <req file>` reads `payload.upload_key` itself; update the `plan-days` and research skills so the key never appears in a routine transcript.
6. **Profile excerpt `dietary` field** (F12): the private repo's excerpt carries `dietary` / `diet` / `diet_rule`; make `dietary` a documented field of the prefs kit's profile schema so every helper gets it, with a test that the excerpt never drops it.
7. **Visit lengths by activity** (F21 follow-up): a booked tea ceremony was timed as a 95-minute neighbourhood stroll. Let the estimator take the activity (ceremony, class, tasting: the booked length) before the category default.
8. **Japan `rating_offset`** (F17): −0.2 for the pilot country was an inference about local rating habits. Check it against the pilot's shortlist (what the owner kept versus skipped) and the Aggregate counts; adjust in the private source table.

## Step 3 — Tuning from the pilot evidence
From plan §6 row 8 and the carried decisions (`TG-PHASE-3.md` "Phase 8" row, `TG-PHASE-4.md` "Phase 8" row): planning (objective weights, the 75-minute wait cap, the 90-minute spill, meal rules — v01.41r already makes a chosen lunch spot the lunch and skips breakfast on a late start), interview and shortlist quality (shortlist caps, the `fit` formula), the gem weights from the owner's taps (✅ 🔖 ❌ per round, `Choices` tab), estimate accuracy (planned versus the owner's account), brochure polish (estimated legs as "≈ N min", `decisions/TG-PHASE-4B.md` item 5), costs (Maps ledger, routine runs, trigger minutes against the 90-minute daily quota), repository use (did known places get reused), and decision 10 (a separate routines environment). Change a weight only with the evidence written next to it in `decisions/TG-PHASE-8.md`.

## Step 4 — Phase 9 follow-ups
From `decisions/TG-PHASE-9.md` §7: (1) interviews in the app for other travellers — scope the profile slot (whose answers, how research and planning weigh them) with the owner first, then build it in the pack and the app; the owner asked that these interviews happen in the app, not in the chat; (2) the masthead (`home` carries the pack's `display_name`, the shell sets the title from it) if the owner wants it; (3) `lock: true` on `registerRoute` and formula escaping in the core store. Finalize `helpers/prompts/TG-PHASE-9.md` as the record of what was built (it is done; mark it so).

## Step 5 — Done when, and bookkeeping
Done when: the owner's answers to Step 1 are recorded; every Step 2 item is fixed or deliberately deferred with the reason; the tuning changes carry their evidence; the private repo is re-pinned and its dry runs pass; `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs` are clean.
Bookkeeping: this repo's push-commit rules (version bump, CHANGELOG with the verbatim prompt — redact place, trip and personal names — README tree for new files, timestamp, Developed-by line). Write `helpers/decisions/TG-PHASE-8.md`, update `helpers/BUILD-STATE.md` (Phase 8 done, log, Next), run `remember session`, push, and tell the owner what changed and what (if anything) the next session should do.

## Rules
- The owner performs every browser, BotFather, Apps Script, GitHub-secret and routine-editor step. Never ask the owner to paste a token, key, chat id, script id or deployment id into the chat.
- Public repo: never commit ids, secrets, e-mail addresses, phone numbers, names, trip or place data of the owner's, or anything from the private repo.
- Live calls only where a step needs them: no bulk research, no repeated `/plan` to compare, no Aggregate smoke. A re-plan after a fix is fine (one per fix).
- Never edit `.github/workflows/auto-merge-claude.yml`, `scripts/setup-gas-project.sh` or the GlobalACL/MasterACL machinery.
- Never commit scratch files or the private repo's `log/maps-usage-ledger.json` from a dry run (`git checkout` it).
- If a usage limit pauses the session, leave `helpers/BUILD-STATE.md` and a resume note under `helpers/status/` accurate and resume from this prompt.

Developed by: LightAISolutions
