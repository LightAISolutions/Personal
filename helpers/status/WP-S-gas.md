# WP-S gas — Tour Guide Scout, core side

**State: done.** Decisions: `helpers/decisions/WP-S-gas.md`. Contract: `helpers/decisions/TG-SCOUT.md`.

## Files
| file | change |
|---|---|
| `helpers/packs/tour-guide/gas/16_scout.js` | new: Scouts tab, `/scout`, `/scouts`, callback `sc`, `scout` envelope handler + `tgEnvValidateScout`, ranked message |
| `helpers/packs/tour-guide/gas/35_scout_app.js` | new: app ops `scout.list`, `scout.get`, `scout.board`, `scout.new` (write), `scout.add` (write) |
| `helpers/packs/tour-guide/gas/00_common.js` | one line: kind `scout` → `SCOUT` when configured, else `RESEARCH` |
| `live-site-pages/helper-app.html` | Scout screen; v01.06w |
| `live-site-pages/html-versions/helper-apphtml.version.txt` | `\|v01.06w\|` |
| `live-site-pages/html-changelogs/helper-apphtml.changelog.md` | `[Unreleased]` entry |
| `helpers/tests/pack_tour-guide_scout_gas.test.js` | new: 17 tests |

## Requests
- R1 (engine work package / coordinator): add `"scout"` to `helpers/packs/tour-guide/helper.json` `envelope_types` together with
  `schemas/tour-guide-scout.schema.json` and the payloads test's `TYPES`. The handler registers as soon as the type is listed;
  nothing else in this package needs to change.
- R2 (bookkeeping): README tree / pack README entries for `16_scout.js`, `35_scout_app.js` and the new test; BUILD-STATE row.

Developed by: LightAISolutions
