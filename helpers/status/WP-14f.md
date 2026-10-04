# WP-14f status — the Takeout fetch

Branch `wp-14f` (worktree of `main` at v01.67r). Brief: the coordinator's WP-14f brief. Decisions and defaults:
`helpers/decisions/WP-14f.md`. **State: done**, pending the coordinator's merge. Never pushed.

## Done
- **A — `?route=takeout`** (`gas/28_lists.js`): POST, auth by a `lists`/`research` request's upload key; `op: list`
  (≤ 3 exports, newest first, parts and sizes, `too_large`) and `op: get` (one part's exact bytes, base64; ≤ 10 MB,
  ≤ 10 gets per request); the brief's refusals in order, audited as briefed. Never writes to Drive (a test snapshots it).
- **B — the daily job** `tg_lists_takeout`: off · never_synced · none · seen · open · opened · error.
- **C — the chat**: `/lists sync` sends the export steps when there is no export, else carries the stamp and marks it
  seen; `/lists` shows the newest export (date, size, too large) or a how-to, and the auto line after a first answered
  sync; `/lists auto on|off`; the help line.
- **D — the client** `lists/lists-fetch.mjs`: `takeoutUrl`, `listTakeout`, `fetchTakeout`, the CLI (exit 0 / 2 / 1);
  `keyFrom` from `tools/upload.mjs`; not re-exported from `lists/index.mjs`; never prints the key.
- **E — `readSavedExports(parts, opts)`** in `lists-read.mjs`, exported from `lists/index.mjs`, documented in the lists
  README. One part gives exactly `readSavedExport`'s result.
- **F — compare**: `compareCut` exported from `scout-rank.mjs` and `scout/index.mjs` (unchanged); `rankScout` compare
  mode adds `already_cut` to `more`; the rankScout comment and one line under TG-SCOUT.md §11.
- **Docs**: lists README ("Fetching the export", the daily job instead of the no-timer bullet, parts, tests); the pack
  README's `28_lists.js` row and Lists section (the `gas/` table lists no pack tools, so lists-fetch is in the section).
- **Tests (new)**: `pack_tour-guide_lists_takeout.test.js`, `pack_tour-guide_lists_fetch.test.js`,
  `pack_tour-guide_lists_parts.test.js`, `pack_tour-guide_compare_cut.test.js`. `gas-mocks.js`: additive (`putTakeout`,
  real bytes on a file).

## Next
- The private side (the `lists-sync` skill): run `lists-fetch.mjs --newer-than <last stamp>` into a scratch dir, then
  `readSavedExports`; for a long compare list, `compareCut` on the bare records before the lookups, then
  `rankScout(…, { already_cut })`.

## REQUESTs
- **Coordinator, SPEC §16** (WP-14d's lists row, or a WP-14f row): add `helpers/tests/pack_tour-guide_lists_{takeout,fetch,parts}.test.js`,
  `helpers/tests/pack_tour-guide_compare_cut.test.js`, `helpers/status/WP-14f.md`, `helpers/decisions/WP-14f.md`; the
  `takeout` route and daily job `tg_lists_takeout` in `gas/28_lists.js` and `lists/lists-fetch.mjs` (already under
  `lists/*`) in its description; and `compareCut`/`already_cut` in `scout-rank.mjs` in the C14 ranking row's description (the `scout/scout-{weights,rank,…}.mjs` row).
- **Coordinator, SPEC §6**: the "`?route=<name>` registered by a pack" row says the tour-guide pack registers `app`;
  add "and `takeout` (POST, `none`; a `lists` or `research` request's `upload_key` in the body — `gas/28_lists.js`)".
- **Coordinator, SPEC §3** (the request file, `upload_key`): "the request's key for `?route=upload` (§6)" could add
  "and, in the tour-guide pack, for `?route=takeout`".

## Tests outside my paths that I changed
- `helpers/tests/pack_tour-guide_lists.test.js` (WP-14d): three `H.putTakeout(…)` lines before `/lists sync` calls,
  each marked `C14f` — `/lists sync` now needs an export in Drive (part C). Nothing else changed.

Developed by: LightAISolutions
