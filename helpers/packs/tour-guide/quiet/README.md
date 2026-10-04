# quiet — Quiet

A branch of the Tour Guide pack (TG-PHASE-16 WP-16a, Contract C16), first written by `node helpers/tools/new-branch.mjs quiet` and filled in by hand. For a crowd magnet the owner wants to see anyway, a board of up to 3 quieter places of the same kind within 30 minutes of it, and the magnet's own quietest hours. The owner adds the places they like to the trip's Later list. A planned day offers a 🕊 button for the stops the planner timed around the crowds.

| Part | Where |
|---|---|
| `/quiet <place> [on <date>]` → request kind `quiet` `{ trip?, place, slug?, date? }`; `/quiet` alone: the coming stops a 🕊 button is offered for, then the last 5 boards to resend, then the how-to | `gas/43_quiet.js` |
| Routing: RESEARCH, or DISCOVER when configured (a discovery kind) | `gas/43_quiet.js` |
| The words: `parseQuietText(text, { today })` (engine) and `tgQuietParse(text, today)` (core) agree on a shared case list; dates read as `/daytrip`'s | `quiet/quiet-text.mjs`, `quiet/fixtures/quiet-parse-cases.json` |
| Ranking: `quietRatio`, `quietPart`, `quieterWord`, `isBusy`, `rankQuiet` (screens, the five-part score, ties, `more`, labels), `quietLine`, `pickRadius` | `quiet/quiet-rank.mjs` |
| Payload: `validateQuietPayload`, `checkQuiet`, `quietId`, `quietPayload`; the schema | `quiet/quiet-payload.mjs`, `schemas/tour-guide-quiet.schema.json` |
| Envelope `quiet`: core validator `tgEnvValidateQuiet` (own data only: `tgScoutGoogleKeys`; ≤ 12 000 characters; an unknown trip refused), the `Quiet` tab (one row per board; a re-delivery keeps each added place still on it), the card | `gas/43_quiet.js` |
| Buttons `qt:<key>:<n>` (➕ onto the Later list, ✅ once added), `qt:<key>:s` (resend), `qt:<trip key>:<YYYYMMDD>:<tag>` (a day's 🕊: the request for that stop and date) | `gas/43_quiet.js` |
| The 🕊 rows under the day card and the morning message: `tgQuietDayRows(trip, day)` through the C16 hook (`tgCmdDayRows`), at most 2, none on a past day | `gas/43_quiet.js` |
| App ops `quiet.list`, `quiet.get`, `quiet.add` (write), `quiet.new` (write), `quiet.day`; the Quiet screen and the day view's 🕊 buttons | `gas/38_quiet_app.js`, `live-site-pages/helper-app.html` |
| Invented fixture: valid and invalid payloads, a trip | `quiet/fixtures/quiet-sample.json` |
| Tests | `helpers/tests/pack_tour-guide_quiet.test.js` (parse, validators, command, handler, card), `pack_tour-guide_quiet_gas.test.js` (the 🕊 rows, resend, ➕, the app ops), `pack_tour-guide_quiet_engine.test.js` (engine), `pack_tour-guide_quiet_app.test.js` (the Quiet screen, in a fake DOM) |

## Which stops get a 🕊

A stop with a `crowd_slot` (`opening` or `late`), then a stop a day warning names as having no quieter slot. The warning is the planner's `noQuietSlotText` (`planner/planner-crowd.mjs`); the core reads the name back with `TG_QUIET.WARN_RE`, a prefix match, so a warning cut at 200 characters still names its stop. A parity test holds the two together. A stop with a board for it received in the last 30 days (of the same trip, or of none) gets the resend instead of a new ask.

## The private side

The judgment step is the private skill (`skills/quiet/`): its drivers find the magnet, gather places of the same kind around it (the nearest radius with enough of them), price each walk or ride with Scout's `estimateReach`, ask one judgment for the kind, `fit`, `why`, `best` and the local mentions, then call `rankQuiet` and `quietPayload` and write the envelope with `tools/envelope.mjs quiet … --pack tour-guide`. Coordinates and rating counts stay in the private repo; the payload carries only our words, scores, place ids, names and links.

```js
import { parseQuietText, pickRadius, isBusy, rankQuiet, quietLine, quietPayload } from '…/packs/tour-guide/quiet/index.mjs';
const ask = parseQuietText(request.text, { today });                 // { ok, place, date }
const ranked = rankQuiet(candidates, { magnet: { record, kind }, group, date: ask.date, cityDates, diet, dietRule, visited });
const payload = quietPayload({ trip, createdOn: today, date: ask.date, magnet: { name, slug, place_id, kind,
  busy: isBusy(record, pool), quiet: quietLine({ hours, always_open, tip }), source }, ranked });
```

Check the branch is complete at any time: `node helpers/tools/new-branch.mjs --check quiet`.

Developed by: LightAISolutions
