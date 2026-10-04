# The season sheet — `helpers/packs/tour-guide/season/`

What the trip's dates bring (Contract C11 `trip.season`, WP-11b): weather in words and numbers, blooms and leaves with a
status, and dated events (light-ups, special openings, festivals, markets, holidays, closures), each with its sources.
Trip research writes it; the gem screen uses it to drop single-bloom gardens out of season; the planner and the day
cards read the events. **Library only**: pure functions, no call, no file write, no clock. Bloom months and their
sources: `helpers/decisions/WP-11b.md`.

| File | Exports |
|---|---|
| `season-normalize.mjs` | `normalizeSeason(raw) → { ok, season, errors }`: trims, drops nulls, lower-cases the enum words, then the trip schema's `season` subset plus `checkSeason`; unknown keys are refused. `seasonSchema()` |
| `season-bloom.mjs` | `eventsOn(season, date, { kinds? })`: the events running on a date, timed first by start, then by name. `bloomOn(season, date)`: one line such as `'Autumn leaves at their peak · Roses past their best'`, `''` when nothing is known. `bloomKindOf(place)`: the one bloom a garden or park is about, else null. `usualMonths(kind, lat)`: `BLOOM_MONTHS_NORTH`, shifted six months south of the equator, null within `TROPICS_LAT` (23.5°). `forecastSays(season, kind, dates)`: true / false / null. `outOfSeason(place, { season?, date? or dates, lat? })`: the forecast wins, then the usual months; anything unknown is false. Phase 13 (A6): roses run May–November; `autumnCherry(place)` — a cherry place naming an autumn-flowering cherry (English or the local terms, `AUTUMN_CHERRY_WORDS`) is in season in October–December too |
| `fixtures/season-fixture-full.json` | An invented autumn sheet carrying every field |

Tests: `helpers/tests/pack_tour-guide_season.test.js`; the screen rule in `pack_tour-guide_gems_c11.test.js`.

Developed by: LightAISolutions
