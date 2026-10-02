# Helper framework

A **helper** is a personal Telegram chatbot with three parts: a Google Apps Script web app (the **core** from `core/`, bundled with a **pack** from `packs/<name>/`), one or more Claude Code **Routines** (the **brain**) that run with the helper's private repo attached, and a Google Drive **mailbox** the two talk through. This directory is the public, reusable part of every helper; the first helper built on it is the Tour Guide (plan: `../repository-information/TOUR-GUIDE-BUILD-PLAN.md`). The contract is `SPEC.md`.

## Layout

```
helpers/
  SPEC.md                    the framework contract (envelope v1, mailbox, wake route, manifest, registries, properties, limits)
  BUILD-STATE.md             phase tracker for the Tour Guide build (generic progress only)
  core/                      Apps Script core: config, registries, store, Telegram, queue, executor, mailbox, router, wake, setup page
  tools/                     bundle.mjs · envelope.mjs · upload.mjs · new-helper.mjs · boundary-check.mjs (+ boundary-allowlist.txt)
  kits/                      shared Node libraries (maps, research, brochure, prefs — Phase 2)
  packs/<name>/              one directory per helper: helper.json, gas/ (pack-side Apps Script), schemas, engines, fixtures
  packs/hello/               the smallest pack; proves the registries and the test harness
  templates/private-repo/    skeleton of a helper's private repo (dual-mode CLAUDE.md, skills, memory dirs, memory workflow, vendor/)
  tests/                     node --test suites and the in-memory Apps Script mocks (tests/harness/gas-mocks.js)
  prompts/ · decisions/ · status/   one file per phase or work package of the build
```

Build agents live in `../.claude/agents/hb-*.md`; CI, publishing and deploys in `../.github/workflows/helpers-ci.yml`, `helpers-dist.yml` and `deploy-helper.yml` (SPEC §14).

## Quick start

```
node --test helpers/tests/                     # every suite, from the repo root
node helpers/tools/bundle.mjs hello --check    # bundle a pack without writing (drop --check → helpers/dist/hello/)
node helpers/tools/boundary-check.mjs          # the public-repo check CI runs; exit 1 on any finding
```

Node 22, no npm install: the framework has no runtime dependencies (kits that need one say so in their README).

## How to add a helper

Full procedure: SPEC §17. In short:

1. `node helpers/tools/new-helper.mjs <name> --display "<Name>" --drive-root <Root> --prefix <PREFIX> --private-repo <Org>/<Repo> --private-out ../<Repo>` — scaffolds `packs/<name>/` and the private repo from the template.
2. Fill `helper.json` and `gas/<name>.js` (registries only — SPEC §5), add `tests/pack_<name>_*.test.js`, and get `bundle --check`, the tests and the boundary check clean.
3. Push; the merge to `main` republishes the `helpers-dist` branch. Create the private repo, pin `helpers-dist` at `vendor/helpers/` (SPEC §15).
4. Create the Apps Script project, add `<HELPER>_SCRIPT_ID` / `<HELPER>_DEPLOYMENT_ID` to this repo's `production` environment, run `printSetupUrl()` and work down the setup page, then register the routines.

## Public and private — the rule that shapes everything

This repository and its GitHub Pages site are **public**. Everything about a helper lives in exactly one of three homes (plan §1, SPEC §1):

| Here (public) | The helper's private repo | The owner's Google account |
|---|---|---|
| Generic code only: core, tools, kits, packs with **invented** fixture data, tests, templates, build agents, prompts, decisions | Persona and safety rules (`CLAUDE.md`), skills, routine prompt texts, memory, quarantine, logs, the pinned `vendor/helpers/` | Drive root (state Sheet, mailbox, documents), Script Properties (tokens, secrets, keys), Actions secrets for deploys |

- Never commit ids, tokens, keys, e-mail addresses, phone numbers, names, trip or place data, or anything copied from a private repo. Fixtures use reserved domains (`example.com`, `.invalid`).
- Personal-data paths (`profile*`, `people/`, `projects/`, `trips/`, `places/`, `log/`, `quarantine/`) never exist here except as an empty `.gitkeep` inside the template.
- `tools/boundary-check.mjs` enforces both rules in CI on every push touching `helpers/`; `tests/tools_boundary.test.js` plants a fake secret and a personal-data path and asserts the check fails.
- The brain is a reader. Its only writes are envelopes into the mailbox and memory into its private repo; every side effect on the owner's accounts is a `proposal` the owner approves in Telegram (SPEC §11).

Developed by: LightAISolutions
