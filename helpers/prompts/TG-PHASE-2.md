# Phase 2 — Shared kits (Maps · Research · Brochure · Prefs)

> Start this in a **new session** on **Opus 5.5 · effort high** with the prompt: `Read helpers/prompts/TG-PHASE-2.md and execute it exactly.`
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` §4.1, §5, §6 row 2, §7, §8. Written by Phase 1 (`helpers/decisions/TG-PHASE-1.md`); progress in `helpers/BUILD-STATE.md`.

You are the **coordinator** for Phase 2 of the Tour Guide build. Four work packages run in parallel, each in its own worktree with its own `hb-*` agent; you own the contract files, the merges, the bookkeeping and the single push. Work autonomously inside this repo's conventions; when a choice is not covered by the plan or `helpers/SPEC.md`, pick the sensible default and record it in `helpers/decisions/TG-PHASE-2.md`. Ask the owner only for what §3 names.

## Step 0 — Orient
1. Read `CLAUDE.md` (it applies in full: session checklist, one push per interaction, push only to this session's `claude/*` branch and wait for it to vanish from the remote before pushing again), `helpers/BUILD-STATE.md`, `helpers/decisions/TG-PHASE-1.md`, `helpers/SPEC.md` (§1 homes, §16 file-ownership map, §17, §18) and `helpers/README.md`.
2. Confirm the `helpers-dist` branch exists on GitHub (published by the merge of v01.12r). If it does not, run the **Helpers dist** workflow by hand (`workflow_dispatch`) and check again; nothing in this phase needs it, but Phase 4 does and the fix is one click now.
3. Run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`; all three must be clean before any kit work starts.
4. `AssistantBrain` stays reference only; `TourGuide` is not touched in this phase.

## Step 1 — Fan out
One worktree and branch per kit, never pushed: `git worktree add ../wt-2a -b wp-2a` (and `2b`, `2c`, `2d`). Each WP gets a brief that quotes its row from §2, its paths from SPEC §16, and the rules at the end of this file; it writes `helpers/status/WP-2<x>.md` (progress, requests to the coordinator) and `helpers/decisions/WP-2<x>.md` (every default it chose). Agents (`.claude/agents/`): 2a `hb-builder-opus`, 2b `hb-builder-opus`, 2c `hb-builder-fable`, 2d `hb-builder-opus`. `hb-builder-opus` runs at effort **high**; the plan asks for medium on 2b and 2d — add `.claude/agents/hb-builder-opus-medium.md` (copy of `hb-builder-opus.md` with `effort: medium`) if you want the plan's setting, and record the choice. 2d's reader pattern is exercised with fixture evidence only; `hb-reader` is the agent that later phases run against real connectors.

Kit layout (SPEC §16): `helpers/kits/<kit>/{README.md, index.mjs, lib/, fixtures/}`, tests in `helpers/tests/kit_<kit>_*.test.js`, zero runtime npm dependencies unless the kit's README names each one and its decisions file says how it is installed where routines run. Every new file ends with `Developed by: LightAISolutions`.

## Step 2 — The four kits (plan §6 row 2)
| WP · agent | Deliverable | Contract |
|---|---|---|
| **2a Maps kit** · `hb-builder-opus` (Opus 5.5 · high) | `helpers/kits/maps/` | Places API (New) + Routes API client. **Fixed field masks as constants** per plan fact 2 (Essentials / Pro / Enterprise / Enterprise + Atmosphere tiers), never free-form; a **SKU counter with a hard stop** at a configurable monthly ceiling (counts by SKU, not by request; plan fact 3 prices, §8 volumes); **30-day snapshot purge** — confirm plan fact 7's caching clause against the current Places terms before relying on it and record the finding; a **Maps URL builder** (directions and place links). Network is mocked in tests; **live smoke calls** (one Place Details, one Text Search, one Compute Routes) run only behind an explicit `--live` flag from the Claude HQ environment, where the key is an API credential the proxy injects — confirm the credential header type (`X-Goog-Api-Key`, empty prefix) by making the call, never by asking for the key. Optional: a Grounding Lite spike, time-boxed, recorded in the decisions file either way |
| **2b Research kit** · `hb-builder-opus` (Opus 5.5 · medium if added, else high) | `helpers/kits/research/` | The research-run contract routines follow (plan §5.2): per-run **budgets** (searches, fetches, wall time) enforced by the kit; a **source ledger** schema (URL, fetched date, what it supported); the **two-source rule** for any fact a plan depends on; **confidence labels**; **injection handling** — page text is data, and tests feed it instructions that must be ignored and flagged `injection_suspect`. No live web calls in this phase: fetch and search are injected interfaces with fixture responses |
| **2c Brochure kit** · `hb-builder-fable` (Fable 5.1 · high) | `helpers/kits/brochure/` | Design tokens and type scale, **print CSS**, an HTML **renderer** that produces one self-contained document (inlined CSS and images; plan §5.7 sections: cover, trip at a glance, day spreads with timeline rail and route sketch, place cards, "saved for later", practical info, attribution), the **PDF step** with Playwright using the pre-installed Chromium (`executablePath: '/opt/pw-browsers/chromium'`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, never `playwright install`), and the **attribution block** (Google data attribution per the Maps terms). Design is the deliverable: iterate with screenshot review using `.claude/skills/imported--frontend-design`, and render a sample brochure from **invented** fixture data for the owner to rate. Playwright is the one allowed dependency; the decisions file records how routines get it |
| **2d Prefs kit** · `hb-builder-opus` (Opus 5.5 · medium if added, else high) | `helpers/kits/prefs/` | The connector-reader pattern (plan §5): **evidence → quarantine → owner-confirmed profile**. Evidence records (source, date, excerpt, what it suggests) are written as quarantine notes; a confirm step promotes them into a profile document; nothing enters the profile without the owner's word. Built and tested on fixture evidence only — no connector reads in this phase |

Coordinator: when a WP reports done in its status file, merge `wp-2<x>` into the session branch, run the three checks, and resolve any conflict by the ownership map (two WPs never own the same file). Review each kit's README against its row above before merging.

## Step 3 — Owner input (plan §6 row 2)
Nothing beyond Phase 0's key. Optionally the owner names three test places for 2a's smoke calls; otherwise 2a picks three well-known public landmarks and says which. Post the sample brochure (PDF, from fixture data) in the thread and ask the owner to rate it — "would hand to a friend" is the bar; iterate 2c until it passes.

## Step 4 — Done when (plan §6 row 2)
- Each kit's tests green in `node --test helpers/tests/`; `bundle --all --check` and the boundary check clean; `helpers-ci` green on the push.
- One live Places call and one live Routes call succeeded from Claude HQ through the API credential (inside the free caps), with the SKU counter showing the two calls.
- A sample brochure PDF from fixture data that the owner rates "would hand to a friend".
- No id, secret, personal string, trip or place of the owner's in `helpers/`; fixtures are invented.

## Step 5 — Repo bookkeeping (this repo's `CLAUDE.md`)
Single push commit after all four kits are merged: version bump, CHANGELOG section with the verbatim prompt, README tree entries for every new file (kits, status, decisions, tests), README `Last updated`, `REPO-ARCHITECTURE.md` if the flowchart's Helper Framework subgraph needs a `kits/` detail (regenerate the mermaid.live URL per `.claude/rules/mermaid-diagrams.md`), `Developed by: LightAISolutions` on every new file.

## Step 6 — Hand off Phase 3
Write `helpers/decisions/TG-PHASE-2.md` (every coordinator default, the smoke-call findings on fact 7 and the credential header, the brochure rating), update `helpers/BUILD-STATE.md` (Phase 2 done, log, Next), and write `helpers/prompts/TG-PHASE-3.md` for the Tour Guide engine (plan §6 row 3: `packs/tour-guide/` schemas, visit-time estimator, planner + solver, Later lists, fixtures; solver on **Fable 5.1 · high**, the rest **Opus 5.5 · high**; Phase 3 done-when from the plan). Then run `remember session`, push, and tell the owner: "Phase 2 done. Start a new session on Fable 5.1 · high and paste: `Read helpers/prompts/TG-PHASE-3.md and execute it exactly.`"

## Rules
- Public repo: never commit ids, secrets, e-mail addresses, phone numbers, names, trip or place data of the owner's, or anything from a private repo. Fixtures use invented data and reserved domains.
- Edit only the paths your WP owns (SPEC §16); requests for anything else go in your status file.
- Live Google API calls: 2a only, behind `--live`, only from Claude HQ, only the smoke calls above. No other kit makes a network call in this phase.
- Never edit `.github/workflows/auto-merge-claude.yml`, `scripts/setup-gas-project.sh` or the GlobalACL / MasterACL machinery.
- If a usage limit pauses the session, leave `helpers/BUILD-STATE.md` and the status files accurate and resume in a new session from this prompt.

Developed by: LightAISolutions
