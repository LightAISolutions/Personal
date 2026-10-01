# Phase 1 — Helper framework foundation

**Recommended session settings:** **Fable 5.1 · effort xhigh** (architect role: every later package builds on the contracts fixed here). New session in the Tour Guide project on **Claude HQ**, repo `LightAISolutions/Personal`. No API keys are needed in this phase.

You are the architect for Phase 1 of the Tour Guide build. Work autonomously inside this repo's conventions; when a choice is not covered by the plan, pick the sensible default and record it in `helpers/decisions/TG-PHASE-1.md`. Ask the owner only where the plan says so (the scrub-report gate in Step 3).

## Step 0 — Orient
1. Read, in this order: `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-0.md`, `repository-information/SESSION-CONTEXT.md`, then `repository-information/TOUR-GUIDE-BUILD-PLAN.md` §1, §2, §3 (facts 7–11), §4 (all of it), §6 row "1 — Helper framework foundation", §7 and §9.
2. This repo's `CLAUDE.md` applies in full (Session Start, Pre-Commit and Pre-Push checklists, bookends per the toggles). Work on the session's `claude/*` branch; `auto-merge-claude.yml` merges it into `main`. One push per interaction; wait for the branch to disappear from the remote before pushing again.
3. `LightAISolutions/AssistantBrain` is **reference only**. Read it; never commit to it. If it is not attached to the session, attach it read-only.
4. Confirm from `BUILD-STATE.md` whether the private `TourGuide` repo exists and is attached. Phase 1 does not need it except for the §4.3 measurement in Step 6; if it is still missing, do the measurement against a scratch clone of `helpers-dist` and note it.

## Step 1 — Scrub report before any copy (owner gate)
AB's `gas/core/*.js`, `tools/envelope.mjs`, `tools/bundle.mjs`, `tests/` harness and mocks, `.github/workflows/{ci,deploy-assistant-core,merge-routine-memory}.yml`, `scripts/merge-routine-memory.sh`, `.gitattributes` and `docs/SPEC.md` are the sources to generalize. Before copying a single line into this **public** repo:
- grep every candidate file for script ids, deployment ids, spreadsheet or folder ids, bot or chat ids, e-mail addresses, phone numbers, names, URLs with secrets, `ShadowAISolutions` provenance lines and anything from AB's `profile.md`, `people/`, `projects/`, `log/`, `quarantine/`;
- write the findings to `helpers/decisions/TG-PHASE-1.md` → "Scrub report" (file, line, what, how it is removed or parameterized);
- post the report in the thread and **wait for the owner's OK** before the copy lands in a commit. Everything that is not the copy (SPEC drafting, agents, workflows, tests scaffolding) may proceed meanwhile.

## Step 2 — Build (plan §4.1 and §6 row 1)
| Deliverable | Contract |
|---|---|
| `helpers/core/` | AB's `gas/core` generalized: per-helper Drive root folder, bot and property prefix taken from a pack manifest; registries (`02_registry.js` pattern) as the only extension point; executor runs allowlisted actions after an owner ✅; mailbox relay; **wake route** (`?route=wake`: unauthenticated, idempotent, rate-limited, sweeps the mailbox and delivers replies, nothing else); no permanent tick (one-off `after()` triggers only) |
| `helpers/tools/` | `bundle.mjs` (reads `helpers/packs/<name>/helper.json`, emits one Apps Script project from core + pack `gas/`), `envelope.mjs` (verbatim from AB, same CLI), `new-helper.mjs` scaffold (creates `packs/<name>/` + a private-repo skeleton from the template), `boundary-check.mjs` (fails on personal-data paths `profile*`, `people/`, `projects/`, `trips/`, `places/`, `log/`, `quarantine/` and on secret/PII patterns: tokens, keys, e-mail addresses, phone numbers) |
| `helpers/templates/private-repo/` | Dual-mode `CLAUDE.md` ("Which mode are you in?" → ROUTINE MODE with two-lane rules, mailbox protocol, memory conventions, untrusted-text rule / development mode → `repository-information/DEV-SESSION.md`), `skills/README.md`, memory dirs, `.gitattributes` (`log/*.md merge=union`), `merge-routine-memory.yml` + script, `repository-information/SESSION-CONTEXT.md`, a trimmed `remember-session` skill (no version bookkeeping), `vendor/helpers/` pin instructions, `routines/README.md` |
| Setup page | In core, with AB's lessons: store `WEBAPP_URL` because `getUrl()` returns `/dev`; `<base target="_top">`; click-to-reveal secrets; read `tz` from state; pairing and admin secret only (no public web page) |
| `helpers/SPEC.md` | Framework contract: envelope v1 (types, schemas, limits), mailbox layout (`<Helper>/mailbox/{to-brain,from-brain,archive}`), `req_<id>.json` requests, wake route, pack manifest (`helper.json` fields), registries, Script Property names (`BOT_TOKEN`, `ADMIN_SECRET`, `WEBAPP_URL`, `ROUTINE_FIRE_URL_*`, `MAX_ROUTINE_FIRES_PER_DAY`, optional keys), file-ownership map for Phase 2+ work packages, how a new helper is added |
| `helpers/README.md` | Framework overview, "how to add a helper", the public/private rules from plan §1 |
| `.claude/agents/hb-architect.md` · `hb-builder-fable.md` · `hb-builder-opus.md` · `hb-reader.md` | Model, effort and `disallowedTools` per role (readers: no shell, web, or account writes), after AB's `ab-*.md` |
| `.github/workflows/helpers-ci.yml` | `node --test helpers/tests/` + `node helpers/tools/boundary-check.mjs` on every push touching `helpers/**`; must pass on a planted fake secret test (the test plants, the check must fail, the test asserts the failure) |
| `.github/workflows/helpers-dist.yml` | After each merge to `main` touching `helpers/**`, publish `helpers/` as the `helpers-dist` branch (public, no credentials) |
| `.github/workflows/deploy-helper.yml` | From this repo's `clasp-deploy-pilot.yml` plus AB's `deploy-assistant-core.yml`: matrix over `helpers/packs/*/helper.json`, test gate, `environment: production` locked to `main`, `umask 077`, credential cleanup, runs only on `push` to `main` (never on pull requests, public repo); secrets `CLASPRC_JSON`, `<HELPER>_SCRIPT_ID`, `<HELPER>_DEPLOYMENT_ID` named in the workflow but not created yet |
| Routine-mode guard | Three lines at the very top of this repo's `CLAUDE.md`: if the session was started by a routine, ignore the rest of the file and follow the attached helper repo's `CLAUDE.md` |
| `helpers/tests/` | `node --test` suites + Apps Script mocks from AB's harness; a `hello` pack in `helpers/packs/hello/` that bundles and runs in the mocks |

## Step 3 — Decide subtree vs clone-at-run (plan §4.3)
Measure both ways a private repo can carry `helpers/`: a `git subtree` pin of `helpers-dist` at `vendor/helpers/` versus a shallow clone of `helpers-dist` at routine start. Record size, time, offline behavior and how a pin bump shows in `git diff`. Default stays the subtree unless the measurement clearly favors the clone. Write the chosen procedure (including the `/update-helpers` step for Phase 4+ sessions) into `helpers/SPEC.md` and the private-repo template.

## Step 4 — Done when (plan §6 row 1)
- `node --test helpers/tests/` is green locally and in `helpers-ci.yml`.
- The `hello` pack bundles with `bundle.mjs` and its commands run in the mocks.
- `boundary-check.mjs` blocks the planted fake secret and the planted personal-data path; CI shows the failure, the test asserts it.
- `helpers-dist` branch publishes after the merge to `main` (check it on GitHub).
- No id, secret, personal string or AB provenance line in `helpers/` (scrub report applied; `git grep` for the patterns from Step 1 is empty).
- `AssistantBrain` has no new commits from this session.

## Step 5 — Repo bookkeeping (this repo's CLAUDE.md)
Every push: version bump (`repository-information/repository.version.txt`), CHANGELOG version section with the owner's verbatim prompt, README tree entries for every new file and directory (the `helpers/` subtree, the four agent files, the three workflows), README `Last updated` line, `REPO-ARCHITECTURE.md` gains a `helpers/` node and the three workflows (regenerate the mermaid.live URL per `.claude/rules/mermaid-diagrams.md`). `Developed by: LightAISolutions` on every new file.

## Step 6 — Hand off Phase 2
When Step 4 holds: write `helpers/decisions/TG-PHASE-1.md` (scrub report, subtree decision, every default chosen), update `helpers/BUILD-STATE.md` (Phase 1 done, repo and environment table current), and write `helpers/prompts/TG-PHASE-2.md` for the four parallel kits with their coordinator (plan §6 row 2): coordinator **Opus 5.5 · high**; 2a Maps kit **Opus 5.5 · high** (Places/Routes client with fixed field masks, SKU counter and hard stop, 30-day snapshot purge, Maps URL builder, live smoke calls through the Claude HQ API credential, confirmation of fact 7's caching clause and the credential header type, optional Grounding Lite spike); 2b Research kit **Opus 5.5 · medium**; 2c Brochure kit **Fable 5.1 · high** (design system, print CSS, renderer, Playwright PDF via `/opt/pw-browsers/chromium`, attribution block, screenshot review with `.claude/skills/imported--frontend-design`); 2d Prefs kit **Opus 5.5 · medium**. The prompt names one worktree per kit (`git worktree add ../wt-2<x> -b wp-2<x>`), the file-ownership map from `helpers/SPEC.md`, the `hb-*` agents per kit, `helpers/status/WP-2<x>.md` + `helpers/decisions/WP-2<x>.md` per package, and the Phase 2 done-when from the plan. Then run `remember session`, push, and tell the owner: "Phase 1 done. Start a new session on Opus 5.5 · high and paste: `Read helpers/prompts/TG-PHASE-2.md and execute it exactly.`"

## Rules
- Public repo: never commit ids, secrets, e-mail addresses, phone numbers, names, trip data or AB's personal files. Fixtures use invented data.
- Never edit `.github/workflows/auto-merge-claude.yml`, `scripts/setup-gas-project.sh` or the GlobalACL / MasterACL machinery (plan §2: not reused).
- Keep every live Google API call out of this phase; Phase 2a makes the first one.
- If a usage limit pauses the session, leave `helpers/BUILD-STATE.md` accurate and resume in a new session from this prompt.

Developed by: LightAISolutions
