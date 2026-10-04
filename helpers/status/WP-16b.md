# WP-16b status — Menu check (item 14)

Worktree branch `worktree-agent-a6b4df5824f9b7f55` (from `origin/main` f9b99d5, v01.69r, fast-forwarded to `p16-skeleton`
b35d734). Brief: `helpers/prompts/TG-PHASE-16.md` "WP-16b" and Contract C16. Decisions: `helpers/decisions/WP-16b.md`.

## Step 0
- Fast-forward to `p16-skeleton` clean. Baseline: `node --test helpers/tests/` 1218 tests, 1217 pass, 0 fail, 1 skipped;
  `bundle.mjs --all --check` ok; `boundary-check.mjs` clean; `new-branch.mjs --check menu` complete.

## Done
- Step 0 (orient).
- Step 2: the engine (`menu/menu-text.mjs`, `menu-check.mjs`, `menu-payload.mjs`, `index.mjs`), the schema, the pack
  validator, the fixtures (`menu-sample.json`, `menu-parse-cases.json`) and `tests/pack_tour-guide_menu_engine.test.js`
  (8 tests, green). The generated core test still expects the skeleton's placeholder until the core step lands.

- Step 3: the core module `gas/44_menu.js` (command and /menu alone, validator, Menus tab, card and re-plan offer,
  callbacks, the 🍽 row, menu_checks) and `gas/39_menu_app.js` (five ops); `tests/pack_tour-guide_menu.test.js`
  rewritten on the real fields (15 tests). Full suite: 1235 tests, 1234 pass, 0 fail, 1 skipped.

- Step 4: the Menu screen and the day view's 🍽 button in `live-site-pages/helper-app.html` (Menu tab, `?menu=` link, list,
  check, re-plan, veg card; `dayCard(d, i, total, trip)` asks `menu.day` in the background); `menu.day` also returns `fits`;
  `tests/pack_tour-guide_menu_app.test.js` (5 tests, fake DOM). Checked under Playwright with invented data (scratch script,
  not committed): the list, a check and a day with 🍽 render at 390×844 with no page errors. Version file and changelog
  untouched. Full suite: 1240 tests, 1239 pass, 0 fail, 1 skipped.

- Step 5: docs — `menu/README.md` (the branch README, filled in) and the pack README's rows for `39_menu_app.js` and
  `44_menu.js`; the REQUEST lines below.

## Final checks
- `node --test helpers/tests/`: 1240 tests, 1239 pass, 0 fail, 1 skipped.
- `node helpers/tools/bundle.mjs --all --check`: ok (hello, tour-guide). `node helpers/tools/boundary-check.mjs`: clean.
  `node helpers/tools/new-branch.mjs --check menu`: complete.
- Vendored layout (`helpers` copied to `<scratchpad>/vend/vendor/helpers`, `node --test vendor/helpers/tests/`): 1240 tests,
  1210 pass, 0 fail, 30 skipped — the expected 25 plus the 5 tests of `pack_tour-guide_menu_app.test.js`, which skip without
  the app page exactly as the Day trips and What's on app tests do.

## Next
- Nothing: WP-16b is done.

## REQUESTs
- REQUEST (coordinator, `helpers/SPEC.md` §16): add the row
  "| `helpers/packs/tour-guide/menu/*`, `helpers/packs/tour-guide/gas/{44_menu,39_menu_app}.js`, `helpers/packs/tour-guide/schemas/tour-guide-menu.schema.json`, the Menu screen and the day view's 🍽 button of `live-site-pages/helper-app.html`, `helpers/tests/pack_tour-guide_menu{,_engine,_app}.test.js`, `helpers/status/WP-16b.md`, `helpers/decisions/WP-16b.md` | WP-16b Menu check (Phase 16) | `/menu <restaurant> [on <date>]`, `/menu` alone, the `menu` envelope and the Menus tab, the card's re-plan offer and buttons (`mn:`), the 🍽 row on the day card and the morning message, state.json `menu_checks`; the app's `menu.list`, `menu.get`, `menu.new`, `menu.replan`, `menu.day` |".
- REQUEST (owner of `helpers/packs/tour-guide/schemas/index.mjs`): set `KINDS.menu = checkMenu`, imported with
  `import { checkMenu } from '../menu/menu-payload.mjs';   // C16 (TG-PHASE-16 WP-16b): the menu check's own checks`
  (`menu-payload.mjs` imports nothing that imports `schemas/index.mjs`, so there is no cycle). Until then the schema alone
  passes a check whose `ask` or `sources` break the two cross-field rules; the core and the pack validator already refuse
  them, and `pack_tour-guide_menu.test.js`'s parity case accepts "the schema refuses, or checkMenu does" so it stays green
  both before and after the change.
- REQUEST (owner of the pack README's test list, `helpers/packs/tour-guide/README.md` "Tests" paragraph): add
  `pack_tour-guide_menu`, `_menu_engine` and `_menu_app` to the suites `node --test helpers/tests/` runs.
- MERGE NOTE (coordinator, `live-site-pages/helper-app.html` shared lines that WP-16a's Quiet screen also touches): my
  additions are one `{ id: 'menu', label: 'Menu' }` at the end of SCREENS, `MENU_ID_RE` after `WHATSON_ID_RE`, `menu: ''`
  in S after `board: ''`, one `readParams` line after the `board` line, `menu: function () { showMenu(); }` at the end of the
  go() map, `if (s.id === 'menu') S.menu = '';` in buildNav, and in the day view `dayCard(d, i, total, trip)` (4th argument)
  with one line under the dinner (`menuDaySlot`) and the brochure's call passing `trip`. The Menu section itself sits between
  What's on and boot. Keep both screens' entries when resolving; the helper-app version file and changelog are untouched.

## Tests outside my paths changed
- (none)

Developed by: LightAISolutions
