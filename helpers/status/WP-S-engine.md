# WP-S engine — Scout ranking, payload, Place fields and board

**State: done (awaiting the coordinator's merge).**
- Spec: `helpers/decisions/TG-SCOUT.md`. Decisions: `helpers/decisions/WP-S-engine.md`.
- Branch `wp-scout-engine`, worktree `/home/user/wt-scout-engine`. Not pushed.

## Done
- `packs/tour-guide/scout/` — weights, text parsing and queries, ranking and screens, payload and Place fields, board HTML/PDF, index.
- `scout` envelope type: schema, checks, schemas index, `helper.json`, place history event `scouted`.
- Tests: `pack_tour-guide_scout.test.js` (18), `pack_tour-guide_scout_redteam.test.js` (5); pinning lists updated in the payloads, schemas and envelope tests.
- Pack README: Scout section.

## REQUEST (coordinator)
- DONE in v01.53r (owner allowed it 2026-10-03): `helpers/kits/maps/lib/maps-masks.mjs` is not mine to change: add `'places.photos'` to `TEXT_FIELDS.pro` (and the nearby mask), `fieldTier`: `if (field === 'places.photos') return 'pro';`, a test and a maps README line. Until then the skill gets no photo names from Text Search; `fromScoutResult` already keeps `photo: { name, attributions }` in-run only.
- Skill (WP-S skill side): fetch photos at `maxWidthPx` 360 and the static map as JPEG so the app board stays under the size caps.

## Checks
- `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check`, `node helpers/tools/boundary-check.mjs` — green at commit time.

Developed by: LightAISolutions
