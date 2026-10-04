# menu — Menu check

A branch of the Tour Guide pack (TG-PHASE-16 WP-16b, review item 14, Contract C16), first written by `node helpers/tools/new-branch.mjs menu` and filled in by hand. The owner asks whether a restaurant's menu is right for the party; the helper reads the restaurant's own menu and answers with a fits line, the dishes to order, what to ask, the price of each, how many others do not fit, and its sources. A check of a planned dinner offers to re-plan that day; a day whose dinner carries the planner's menu caveat gets a 🍽 button.

| Part | Where |
|---|---|
| `/menu <restaurant> [on <date>]` → request kind `menu` `{ trip, place, date?, slug? }`; `/menu` alone: the planned dinners and the last checks as buttons, then a one-line how-to | `gas/44_menu.js` |
| Routing: RESEARCH, or DISCOVER when configured (a discovery kind) | `gas/44_menu.js` |
| The words: `parseMenuText(text, { today })` (engine) and `tgMenuParse` (core) agree on a shared case list; the date words are /daytrip's | `menu/menu-text.mjs`, `menu/fixtures/menu-parse-cases.json` |
| The judgment's arithmetic: `menuFits`, `menuNote`, `sortDishes`, `menuFact` (the place's `facts.menu`), `CAVEAT_RE` / `menuCaveat`, `menuCounts` / `menuCountsFrom` (a check counts for 30 days) | `menu/menu-check.mjs` |
| Payload: `validateMenuPayload`, `checkMenu`, `menuId`, `menuPayload` (dishes sorted and cut to 12, the rest counted in `others`); the schema | `menu/menu-payload.mjs`, `schemas/tour-guide-menu.schema.json` |
| Envelope `menu`: core validator `tgEnvValidateMenu` (own data only: every Google field refused; ≤ 12 000 characters; an unknown trip refused), the `Menus` tab (one row per check id), the card | `gas/44_menu.js` |
| The re-plan offer: the check's trip's planned days from today whose dinner is the checked place (≤ 3): 🔁 Re-plan day N when the check counts or nothing fits, else "a menu check counts from <date>" | `gas/44_menu.js` |
| Buttons `mn:<key>:s` (resend), `mn:<key>:v` (the veg card), `mn:<key>:r<yyyymmdd>` (a `replan` of that day, the dinner checked again first), `mn:<trip key>:<yyyymmdd>:<tag>` (🍽 Check the menu from a day) | `gas/44_menu.js` |
| The 🍽 row on the day card and the morning message (`tgMenuDayRows`, called by the skeleton's `tgCmdDayRows`); state.json `menu_checks` (the last 30 days) | `gas/44_menu.js` |
| App ops `menu.list`, `menu.get`, `menu.new` (write), `menu.replan` (write), `menu.day` | `gas/39_menu_app.js` |
| The Menu screen (list, ask, a check, re-plan, veg card) and the day view's 🍽 under the dinner (`menu.day`, asked in the background) | `live-site-pages/helper-app.html` |
| Invented fixtures: valid and invalid payloads, a trip; the parse cases | `menu/fixtures/menu-sample.json`, `menu/fixtures/menu-parse-cases.json` |
| Tests | `helpers/tests/pack_tour-guide_menu.test.js` (parse, validators, command, card, offer, buttons, 🍽 row, snapshot, app ops), `pack_tour-guide_menu_engine.test.js` (engine), `pack_tour-guide_menu_app.test.js` (the Menu screen and the 🍽 button, in a fake DOM) |

## The private side

The judgment step is the private skill (`skills/menu/`): its drivers find the restaurant's own menu page, read it, judge each dish against the party's diet (`yes`, `ask` with what to ask, or does not fit), then call `menuPayload` and write the envelope with `tools/envelope.mjs menu … --pack tour-guide`. The payload carries only the menu's own words (names, local names, prices), our judgment and the source links; never a Google field.

```js
import { parseMenuText, menuPayload, menuFact } from '…/packs/tour-guide/menu/index.mjs';
const ask = parseMenuText(request.text, { today });                 // { ok, place, date }
const payload = menuPayload({ trip, createdOn: today, date: ask.date, place, checked: today, read: true, diet, dishes, others, sources });
const fact = menuFact(payload);                                     // what the planner's dinnerMenu reads next time
```

Check the branch is complete at any time: `node helpers/tools/new-branch.mjs --check menu`.

Developed by: LightAISolutions
