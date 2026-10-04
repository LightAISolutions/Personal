# WP-16a status — Quiet (item 13)

Branch `worktree-agent-a66e6880df2c32bca` (fast-forwarded to `p16-skeleton` b35d734). Brief:
`helpers/prompts/TG-PHASE-16.md` "WP-16a". Decisions: `helpers/decisions/WP-16a.md`.

## Step 0
- Baseline after the skeleton: `node --test helpers/tests/` 1218 tests, 1217 pass, 0 fail, 1 skipped.

## Done
- **Step 2–3, the engine and the schema.** `quiet/quiet-text.mjs` (parseQuietText), `quiet/quiet-rank.mjs` (QUIET,
  quietRatio, quietPart, quieterWord, isBusy, rankQuiet, quietLine, pickRadius), `quiet/quiet-payload.mjs`
  (validateQuietPayload, checkQuiet, quietId, quietPayload), the full C16 schema, the shared parse cases and the fixture
  (its first board made by the engine). Test: `pack_tour-guide_quiet_engine.test.js` (13 tests).

- **Step 4–5, the core and the app ops.** `gas/43_quiet.js`: /quiet (with a date, alone as a list), the Quiet tab, the
  `quiet` validator, handler and card, the `qt` buttons (➕, resend, the day's ask), tgQuietDayRows for the C16 hook.
  `gas/38_quiet_app.js`: quiet.list, quiet.get, quiet.add, quiet.new, quiet.day. Tests: `pack_tour-guide_quiet.test.js`
  (10, rewritten on the real payload) and `pack_tour-guide_quiet_gas.test.js` (8, the Lark Bay world). Full suite
  1243 tests, 1242 pass, 1 skipped.

- **Step 6, the app page.** `live-site-pages/helper-app.html`: the Quiet tab (SCREENS, `QUIET_ID_RE`, `&quiet=` read
  at launch, go(), the nav's reset), the Quiet section (ask form, boards, one board with ➕ Add to Later, bars, labels
  and the left-out words) and the day view's 🕊 buttons (`quietDayRow`, called from dayCard behind a `typeof` guard so
  a VM without the section still builds the card). Test: `pack_tour-guide_quiet_app.test.js` (8). The version file and
  the page changelog are not mine and are not touched. Full suite 1251 tests, 1250 pass, 1 skipped.

- **Step 7, the docs.** `quiet/README.md` rewritten (parts, which stops get a 🕊, the private side); the pack README rows
  for `38_quiet_app.js` and `43_quiet.js`.
- **Checks (final):** `node --test helpers/tests/` 1251 tests, 1250 pass, 0 fail, 1 skipped; `bundle.mjs --all --check`
  ok; `boundary-check.mjs` clean; `new-branch.mjs --check quiet` complete; vendored layout (helpers copied to a temp
  `vendor/helpers` outside the repo) 1251 tests, 1218 pass, 0 fail, 33 skipped (the 25 expected plus the 8 tests of
  `pack_tour-guide_quiet_app.test.js`, which skip without the app page, as the other app tests do).

## Next
- Done; handed back. Nothing pending on my side beyond the requests below.

## Requests
- REQUEST (schemas/index.mjs, nobody's this phase): wire `checkQuiet` from `packs/tour-guide/quiet/quiet-payload.mjs`
  into `KINDS.quiet` (now null), as `checkDaytrip` is for `daytrip`.
- REQUEST (helpers/SPEC.md §16, nobody's this phase): add the ownership rows for `gas/43_quiet.js`, `gas/38_quiet_app.js`,
  `schemas/tour-guide-quiet.schema.json`, `packs/tour-guide/quiet/**` and the quiet tests (WP-16a).

## Tests outside my paths changed
- `pack_tour-guide_daytrip_app.test.js`, `pack_tour-guide_vegcard_app.test.js`, `pack_tour-guide_whatson_app.test.js`:
  each runs go() in a VM with a stand-in per screen it dispatches; go() now dispatches the Quiet screen (C16), so each
  list gains `'showQuiet'` (one line each, marked `C16`). No assertion changed. (WP-16b's Menu screen will need the same.)

Developed by: LightAISolutions
