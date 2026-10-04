# WP-14c status — the veg card, and the brochure PDF in the app

Branch `wp-14c` (worktree of `origin/main` at v01.65r). Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14c" (read from
the coordinator's checkout; not copied here). Decisions and defaults: `helpers/decisions/WP-14c.md`.

## Step 0
- Read the brief (Step 0, Contract C14, WP-14c, Rules), SPEC §5/§16/§18, the pack README, TG-SCOUT.md, TG-PHASE-13.md,
  WP-13c.md, WP-13d.md, Scout end to end (gas/16_scout.js, gas/35_scout_app.js, scout/, the scout schema, the Scout
  tests, the app's Scout screen), the travellers' diet code, the brochure kit's page conventions and gas/18_morning.js,
  gas/32_app_api.js and the /brochure path in gas/10_commands.js.
- Baseline: `node --test helpers/tests/` 978 tests (977 pass, 1 skipped), `bundle.mjs --all --check` ok,
  `boundary-check.mjs` clean.

## In progress
- Nothing. Ready for the coordinator.

## Done
- Engine (`vegcard/`): the phrase table (Japanese exactly as in the brief), `vegCard`, `vegCardFp`, `LANG_BY_COUNTRY`,
  `classify`, the chat and printable renderers, `validateVegCardPayload`, README and an invented fixture party
  (`pack_tour-guide_vegcard.test.js`).
- Schema `schemas/tour-guide-veg-card.schema.json`, `veg_card` in `helper.json` `envelope_types`, the kind registered in
  `schemas/index.mjs` (see REQUESTs).
- Core `gas/27_vegcard.js`: the VegCards tab, `/vegcard` and `/vegcard rebuild`, kind `vegcard` → RESEARCH, the
  `veg_card` handler (validate, unknown trip refused, store, send-or-silent), the morning line helper.
- Core `gas/37_vegcard_app.js`: `vegcard.get`. `gas/32_app_api.js`: `has_vegcard` on the trip row and `brochure.pdf`
  (sent / building / outside refused and audited / once a minute). `gas/18_morning.js`: the link, on full and free days
  (`pack_tour-guide_vegcard_gas.test.js`).
- App `live-site-pages/helper-app.html`: the 🥗 button on the home trip row, the full-screen Veg card screen (hide
  English), the brochure screen's "📄 PDF" button (`pack_tour-guide_vegcard_app.test.js`, skips without the page).
  Checked in headless Chromium at 390×844 (Japanese card, hidden English, English-only card, PDF row): no page errors.
- Final checks: `node --test helpers/tests/` 1004 tests (1003 pass, 0 fail, 1 skipped); `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean; the vendored-layout run clean.

## Next
- Nothing in this WP. The private side (REQUESTs) builds the card and appends `vegCardHtml` to the brochure.

## REQUESTs
- REQUEST (coordinator): approve the three-line C14 edit to `helpers/packs/tour-guide/schemas/index.mjs` (import
  `checkVegCard`, KINDS `veg-card`, PAYLOAD_KINDS `veg_card`, "Ten kinds" → "Eleven kinds"). Without it
  `validatePayload('veg_card')` and `tools/envelope.mjs --pack tour-guide veg_card` refuse the type.
- REQUEST (coordinator): `gas/18_morning.js` carries two identical C14 lines, not one: the function returns early on a
  free day (decisions, "Morning message").
- REQUEST (coordinator, bookkeeping): bump `live-site-pages/helper-app.html`'s version file, meta tag, `APP_VERSION` and
  page changelog for the Veg card screen and the PDF button; CHANGELOG and BUILD-STATE as usual.
- REQUEST (coordinator): add the WP-14c paths to SPEC §16's ownership map and the pack README (payload row `veg_card`,
  file rows `vegcard/`, `27_vegcard.js`, `37_vegcard_app.js`, the tests); both are outside my paths.
- REQUEST (coordinator): `go()`'s screen table line in `helper-app.html` gains `vegcard: showVegCard`; WP-14b edits the
  same file, so a merge may meet on that line.
- REQUEST (private repo, after the push): a skill step that builds the card with `vegCard({ party, country, trip })`
  from the party's diets (`partyDiet` + size) and sends it as `veg_card`; answer a `vegcard` request (and `rebuild`)
  with `in_reply_to` and **without** the `vegcard:<trip>:<fp>` dedupe key (or with the request id added): the core drops
  a repeated dedupe key for 6 h, so an unchanged card answering `/vegcard rebuild` would never reach the owner. Append
  `vegCardHtml(card)` as the brochure's last page.

## Tests outside my paths that I changed
- `pack_tour-guide_payloads.test.js` (unowned): `veg_card` in TYPES and an EXAMPLES entry; the core-mocks loop
  bootstraps and creates the example's trip, because the core now refuses a card for an unknown trip. Marked C14.
- `pack_tour-guide_schemas.test.js` (unowned): `veg-card` in the list of kinds. Marked C14.
- `tools_envelope.test.js` (unowned): `veg_card` in the tour-guide type list. Marked C14.

Developed by: LightAISolutions
