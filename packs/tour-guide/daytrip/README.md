# daytrip — Day trip

A branch of the Tour Guide pack (TG-PHASE-15 WP-15a, Contract C15), first written by `node helpers/tools/new-branch.mjs daytrip` and filled in by hand. From any base — a trip city or not — the owner asks which day trips are worth it and gets a ranked board of up to 8 within a one-way ride limit. The minutes come from the one rail estimator (`planner/planner-rail.mjs` `rideMinutes`, through Scout's `estimateReach`). The owner keeps the trips they like and, on a trip with planned days, puts one on a day.

| Part | Where |
|---|---|
| `/daytrip [from] <place> [under <N> min\|h] [on <date>]` → request kind `daytrip` `{ trip?, from?, date?, max_minutes }`; no place: from where the current trip stays; no place and no trip: a one-line how-to, nothing asked; `/daytrips` | `gas/41_daytrip.js` |
| Routing: RESEARCH, or DISCOVER when configured (a discovery kind) | `gas/41_daytrip.js` |
| The words: `parseDaytripText(text, { today })` (engine) and `tgDaytripParse(text, today)` (core) agree on a shared case list | `daytrip/daytrip-text.mjs`, `daytrip/fixtures/daytrip-parse-cases.json` |
| Ranking: `reachPart`, `rankDayTrips` (screens, the four-part score, ties, `more`, labels) | `daytrip/daytrip-rank.mjs` |
| Payload: `validateDaytripPayload`, `checkDaytrip`, `dayTripId`, `daytripPayload`; the schema | `daytrip/daytrip-payload.mjs`, `schemas/tour-guide-daytrip.schema.json` |
| A kept trip's day for the planner: `dayTripOutlineEntry` | `daytrip/daytrip-outline.mjs` |
| Envelope `daytrip`: core validator `tgEnvValidateDaytrip` (own data only: `tgScoutGoogleKeys`; ≤ 20 000 characters; an unknown trip refused), the `DayTrips` tab (one row per board; a re-delivery keeps what was kept), the card | `gas/41_daytrip.js` |
| Buttons `dt:<key>:<n>` (keep / un-keep), `dt:<key>:<n>.<d>` (put on a planned day: a `replan` with `daytrip: { board, n }`), `dt:<key>:s` (resend) | `gas/41_daytrip.js` |
| state.json `daytrips_kept` (≤ 20, newest first) | `gas/41_daytrip.js` |
| App ops `daytrip.list` (boards and kept trips), `daytrip.get`, `daytrip.keep` (write), `daytrip.new` (write); the Day trips screen | `gas/33_daytrip_app.js`, `live-site-pages/helper-app.html` |
| Invented fixture: valid and invalid payloads, a trip | `daytrip/fixtures/daytrip-sample.json` |
| Tests | `helpers/tests/pack_tour-guide_daytrip.test.js` (parse, validators, command), `pack_tour-guide_daytrip_gas.test.js` (handler, card, keep, replan, snapshot, app ops), `pack_tour-guide_daytrip_engine.test.js` (engine), `pack_tour-guide_daytrip_app.test.js` (the Day trips screen, in a fake DOM) |

## The private side

The judgment step is the private skill (`skills/daytrip/`): its drivers gather candidates from the base, price each ride with `estimateReach`, ask one judgment for `fit`, `why`, `see`, `eat`, `food`, `season`, `closed` and `stops`, then call `rankDayTrips` and `daytripPayload` and write the envelope with `tools/envelope.mjs daytrip … --pack tour-guide`. Coordinates stay in the private repo; the payload carries only our words, scores, place ids, names and links.

```js
import { parseDaytripText, rankDayTrips, daytripPayload, dayTripOutlineEntry } from '…/packs/tour-guide/daytrip/index.mjs';
const ask = parseDaytripText(request.text, { today });            // { ok, from, max_minutes, date }
const ranked = rankDayTrips(candidates, { maxMinutes: ask.max_minutes, date: ask.date, tripDays });
const payload = daytripPayload({ trip, base: { label }, createdOn: today, maxMinutes: ask.max_minutes, date: ask.date, ranked });
const entry = dayTripOutlineEntry({ name, center, anchors });       // a kept trip's day in the outline
```

Check the branch is complete at any time: `node helpers/tools/new-branch.mjs --check daytrip`.

Developed by: LightAISolutions
