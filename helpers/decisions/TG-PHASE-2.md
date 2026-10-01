# Phase 2 decisions — shared kits (2a Maps · 2b Research · 2c Brochure · 2d Prefs)

> Coordinator session: Opus 5.5 · high, 2026-10-01, branch `claude/tg-phase-2-svjmub`. Prompt: `helpers/prompts/TG-PHASE-2.md`.
> Per-package defaults live in `helpers/decisions/WP-2a.md` … `WP-2d.md`; status and requests in `helpers/status/WP-2*.md`.
> Generic content only: this repo is public.

## 1. Coordinator defaults

| # | Topic | Decision | Why |
|---|---|---|---|
| 1 | Worktrees | One worktree and branch per WP (`../wt-2a` … `../wt-2d`, `wp-2a` … `wp-2d`), never pushed; merged into the session branch with `--no-ff` in the order 2a → 2d → 2b → 2c | Isolation per agent; merge order followed completion |
| 2 | Shared brief | One common-rules brief for every WP: worktree-only edits, no repo bookkeeping in a WP, CommonJS tests that `await import()` ESM, CI has no npm install / network / Chromium, the boundary-check gotchas | Each agent starts from the same contract; bookkeeping stays with the coordinator |
| 3 | Agents | 2a `hb-builder-opus` (Opus 5.5 · high), 2c `hb-builder-fable` (Fable 5.1 · high). **2b and 2d ran on `hb-builder-opus` (high), not medium as planned**: the new `hb-builder-opus-medium` agent file could not be loaded mid-session | One effort step higher than planned for two well-specified kits; no quality cost, slightly more usage. The agent file ships in this push and is available from Phase 3 |
| 4 | SPEC §16 kit CLI form | Changed to `node helpers/kits/<kit>/index.mjs <command>` (and `vendor/helpers/kits/<kit>/index.mjs` from a private repo) | Node does not run a directory's `index.mjs` (WP-2a F6); a per-kit `index.js` or `package.json` would break the unique-basename rule |
| 5 | Plan corrections | `TOUR-GUIDE-BUILD-PLAN.md` gets a "Phase 2a corrections" note above §4, plus edits to the §4.4 GoogleSnapshot row and the §9 caching-risk row | Facts 2, 7, 10 and 12 were wrong or incomplete (§2 below) |
| 6 | Invisible characters | Raw U+200B characters in `helpers/tests/kit_prefs_evidence.test.js` replaced with `​` escapes. The pre-existing ones in core `14_setup.js` and `core_setup.test.js` are left as found | Invisible characters in source are easy to break when editing; core is outside this phase's ownership (request in §4) |
| 7 | Brochure fonts | Keep Bitstream Charter (4 × WOFF2, about 100 KB) in `kits/brochure/assets/fonts/` with its notice; `--no-fonts` falls back to a system serif stack | Identical typography on every device and in the PDF is a large part of "would hand to a friend"; the licence allows redistribution with the notice |
| 8 | Ownership | Each WP owned its `kits/<kit>/`, `tests/kit_<kit>_*`, `status/WP-2<x>.md`, `decisions/WP-2<x>.md`. The coordinator owned `SPEC.md`, the plan, `.claude/agents/`, this file, `BUILD-STATE.md`, `prompts/TG-PHASE-3.md` and all repo bookkeeping | SPEC §16 ownership map, extended for kits |

## 2. Findings (smoke calls and reviews)

| # | Finding | Effect |
|---|---|---|
| F1 | **Maps caching (plan fact 7).** Only place ids may be kept indefinitely and lat/lng for up to 30 days; other Places content may not be cached | The Maps kit keeps all other content **build-scoped** and drops it at each purge. Plan §4.4 and §9 corrected. **Open owner question** (§4): does a brochure delivered to Drive that shows hours and ratings count as caching? |
| F2 | **Credential header (plan fact 10).** The environment injects `X-Goog-Api-Key` only for traffic through the HTTPS_PROXY CONNECT tunnel; a direct connection gets no key and a 403 "unregistered callers" | The kit's transport always tunnels (Node 22's `fetch` ignores HTTPS_PROXY); a regression test guards it |
| F3 | **Live smoke** (2a, `--live`, one run): Text Search Pro 200 in 323 ms, Place Details Enterprise 200 in 159 ms, Compute Routes Essentials 200 in 500 ms | Credential, masks and SKUs work end to end. The ledger counted 2 Text Search Pro calls (one was the failed direct call, not billed), 1 Details Enterprise and 1 Routes Essentials. 4 further free IDs-only calls were made while testing the proxy |
| F4 | **SKU facts (plan fact 2).** `businessStatus` is a Pro field; photos are in the IDs-only SKU; Text Search has no non-ID Essentials SKU | Masks rebuilt per tier; plan corrected |
| F5 | **Grounding Lite (plan fact 12).** The endpoint is reachable (`tools/list` returns 5 tools) but the environment credential does not cover its host; no tool call was made | Not used. Adding its host to the credential is a Phase 7 option |
| F6 | Kit CLI form | See decision 4 |
| F7 | Research kit scope | The routine states claims; the kit does not extract facts from page text automatically | Phase 4 `trip-research` skill writes claims explicitly |

## 3. Brochure rating (owner gate)

Sample: an invented 3-day trip, 12 pages, US Letter (`node helpers/kits/brochure/index.mjs sample <dir>`). Posted in the Phase 2 thread on 2026-10-01 with the question "would you hand it to a friend?".

**Rating: 9/10** (owner, 2026-10-01): "The sample itself looks great! However, I want the attached map to actually be a screenshot of Google map in the final product … 10/10 once the map is fixed." WP-2e (`decisions/WP-2e.md`) replaced the drawn route maps with Maps Static API images carrying the brochure's own markers, and added Google place photos to the cards. A live sample of a real city went to the owner for the re-rating.

## 4. Requests carried to later phases

| For | Request | From |
|---|---|---|
| Owner (before Phase 3c / Phase 4 `brochure-build`) | Decide whether a brochure delivered to Drive may show Google-sourced hours and ratings, or should show them only as a dated "verify before you go" line with a Maps link. Default until answered: show them with the attribution block and the `verified_on` date | F1 |
| Phase 4 (private repo) | A memory path for the Maps usage ledger (e.g. `log/maps-usage-ledger.json` or a `memory_dirs` entry) so the memory merge workflow lands it; set `MAPS_USAGE_LEDGER` (and `MAPS_SNAPSHOT_STORE`, outside git) in the routine prompts | WP-2a |
| Phase 4 | Prefs paths: `--held quarantine/prefs/ --profile profile/travel-prefs.md`; a `PREFS_REF_SALT` secret for hashed source refs | WP-2d |
| Phase 4 | `trip-research` states its claims explicitly through the research kit (no automatic extraction); default budgets 20 searches / 40 fetches / 30 min | WP-2b |
| Phase 4 | Routines building brochures need the global Playwright and Chromium at `/opt/pw-browsers/chromium` (the build image); `build` returns 3 with the HTML written when the PDF step is unavailable | WP-2c |
| Phase 5 (core + pack) | Register the `pf` callback-data prefix (`pf:<cid>:y\|e\|n`); capture the ✏️ reply as the replacement value; HTML-escape review item text; send decisions as a `request` envelope with `payload.kind: "prefs_decisions"`; add a `prefs_review` envelope type to SPEC | WP-2d |
| Phase 6 (red-team) | Core `14_setup.js` and `core_setup.test.js` contain raw invisible characters; replace them with escapes | Coordinator decision 6 |
| Phase 4b / 5 (pack) | Carry Google photo names (`photos[0]` name + author) in the tour-guide snapshot and map them to `google_photo` in `toBrochureModel`; keep the planner's route polylines on legs; the `brochure-build` routine runs the kit with `--google` (needs `MAPS_STATIC_KEY` in the routine environment and the usage ledger) | WP-2e |
| Phase 4b / 5 (planner) | Compute Routes gives no TRANSIT route in Japan (verified live on Tokyo pairs; WALK and DRIVE work). The planner needs a transit fallback there (e.g. walk/taxi times with a "check trains in Google Maps" note, or another timetable source) before `/plan Tokyo` relies on transit legs | WP-2e |
| Owner (before any sale or wide distribution) | Google prohibits Maps as the core of printed guide books; private itineraries are read as supplemental use (WP-2e) | WP-2e |
| Phase 7 | Optional: add the Grounding Lite host to the Maps credential if the engine wants it | F5 |

## 5. Ownership note

Phase 3 adds `helpers/packs/tour-guide/` (schemas, estimator, planner, later, brochure-map, fixtures) and its tests. The kits are consumed as libraries; changes to a kit in Phase 3 are coordinator-owned and must keep that kit's README contract and tests green.

Developed by: LightAISolutions
