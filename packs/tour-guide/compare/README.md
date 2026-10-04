# compare — Compare

A branch of the Tour Guide pack (TG-PHASE-14 WP-14e, item 12), written by `node helpers/tools/new-branch.mjs compare` (see `helpers/tools/README.md`, "Branches") and filled in. The owner puts two to four places, or one of their lists, side by side and sees the scores, parts, labels and warnings Scout shows. The rules are in `helpers/decisions/TG-SCOUT.md`, "Compare".

| Part | Where |
|---|---|
| Command `/compare <a>, <b>[, <c>, <d>] [in <place>]` or `/compare <list> [in <place>]` → request kind `compare` `{ trip?, where?, names \| list }`, routed to `RESEARCH`, or to `DISCOVER` when that routine is configured | `gas/29_compare.js` |
| The list names (folded match) | `tgListNames()` in `gas/28_lists.js` (WP-14d), called only when it exists |
| The ranking: `rankScout(pool, { …, mode: "compare", source, in_where?, listed_on?, not_found? })` | `scout/scout-rank.mjs` |
| The answer: a `scout` envelope with `mode: "compare"`, its `source` and item `flags` (`scoutPayload`) | `scout/scout-payload.mjs`, `schemas/tour-guide-scout.schema.json` |
| Stored in the Scouts tab, shown as the ⚖️ card with ⚠️ warnings and ➕ buttons, marked ⚖️ in `/scouts` | `gas/16_scout.js` |
| The board and the app's Scout screen: the title, the warnings, no topic bar | `scout/scout-board.mjs`, `live-site-pages/helper-app.html` |
| No tab of its own (`--no-tab`): compare boards are rows of the Scouts tab | `gas/16_scout.js` |
| Tests: the command; the engine, both validators, the board, the card and the app view | `helpers/tests/pack_tour-guide_compare.test.js`, `helpers/tests/pack_tour-guide_p14e_compare.test.js` |

The judgment step is the private Discover skill's (WP-14p): it looks the names (or the list's places) up inside the Maps budget, calls `rankScout` in compare mode and writes the `scout` envelope with `--in-reply-to` the request.

Check the branch is complete at any time: `node helpers/tools/new-branch.mjs --check compare`.

Developed by: LightAISolutions
