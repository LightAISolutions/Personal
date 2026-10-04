# WP-13c status — core: stays, stale plans, messages, Scout's raw text and group

Branch `wp-13c` (from `c4d57ba`). Brief: `helpers/prompts/TG-PHASE-13.md` (WP-13c, Contract C13, Rules).
Decisions and defaults: `helpers/decisions/WP-13c.md`.

## Step 0
- Read CLAUDE.md, SPEC (§5, §16, §18), the pack README, the Phase 10–12 decisions and every file the section names.
- Checks at start: `node --test helpers/tests/` 882 tests (881 pass, 1 skipped); `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean.

## In progress
- Nothing. Ready for the coordinator.

## Done
- Item 1 (B4 core half): dated stays in `/lodging` (add, replace on overlap, remove, clear, list), the C13 check,
  `trip_update.lodging` on every kind that carries a trip update, the research line, `/route hotel`, the re-plan offer
  from a stay's first night (`pack_tour-guide_p13c_lodging.test.js`).
- Item 2 (C13): the lodging fingerprint (`tgLgFp`, FNV-1a over self-encoded UTF-8), stamped on `plan` and `replan`;
  `lodging_fp` accepted on `plan_digest` and its parts; the stale-plan line in `/trip`, the day card and the morning
  message (`pack_tour-guide_p13c_stale.test.js`).
- Item 3 (A2): `/dates` day-length refusals say how to make the day valid (`pack_tour-guide_p13c_dates.test.js`).
- Item 4 (A10): the owner's zone turns at the trip's first day start; daily reminders 12 h apart
  (`pack_tour-guide_p13c_reminders.test.js`).
- Item 5 (A11): `tgHtmlClip` cuts long lines only in visible text, links whole or dropped
  (`pack_tour-guide_p13c_html.test.js`).
- Item 6 (A16): parity test of every free-text bound, pack validator vs core mirror; no difference found
  (`pack_tour-guide_p13c_parity.test.js`).
- Item 7: Scout requests carry the owner's words as typed; the app writes `/scout <what> in <where>`; coordinator
  addition: the 🔁 mark for picks already in the owner's places (`pack_tour-guide_p13c_scout.test.js`).
- Item 8 (C13): `scouted` places — Places column, validator, `/places` group, app API and the app's Places screen
  (`pack_tour-guide_p13c_scouted.test.js`).
- Item 9: SPEC (§5 paragraph "Stays and stale plans", §16 ownership row), pack README (payload rows, file rows, Phase 13
  paragraph, Scout engine inputs, tests list), file headers.
- Final checks: `node --test helpers/tests/` 923 tests (922 pass, 0 fail, 1 skipped); `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean.

## Tests outside my paths that I changed
- `pack_tour-guide_gas_trip_tz.test.js` (GAS test, owned) — A10: the zone turns at the first day's start.
- `pack_tour-guide_gas_commands.test.js` (GAS test, owned) — B4: the lodging cell now carries `set_at`.
- `pack_tour-guide_phase12_rehearsal.test.js` (unowned) — B4: the lodging cell now carries `set_at`; marked with B4.
- `pack_tour-guide_gas_sheets.test.js` (GAS test, owned) — item 8: the Places header ends with `scouted`.

## REQUESTs
- REQUEST (coordinator, C13): allow an empty `trip_update.lodging` list (or an explicit clear signal) so `/lodging clear`
  reaches the trip file; today the core sends nothing after a clear, because C13 needs 1–12 stays.
- REQUEST (private repo, after the push): apply `trip_update.lodging` to `trips/<slug>.md`; copy `lodging_fp` from the
  `plan` / `replan` request into `plan_digest` (and every part's top); set `scouted: true` on Scout candidates the owner
  has not chosen in `places_digest`; give Scout its new engine inputs (pack README, Scout section).
- REQUEST (coordinator): the research request's lodging line may now be up to 3000 characters when stays are set
  (12 stays × 200 plus dates); check any limit the routine side assumes.
- REQUEST (coordinator): bump `live-site-pages/helper-app.html`'s version file, meta tag and changelog for the Places
  screen change (scouted group).

Developed by: LightAISolutions
