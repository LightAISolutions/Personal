# WP-14a — decisions (the branch scaffold: `tools/new-branch.mjs` and `--check`)

Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14a" plus the coordinator's two additions: `--no-tab`, a lone `--no-envelope`, and the all-three-off shape. Guide: `helpers/tools/README.md` "Branches".

1. **How the check learns a part is not needed: one marker line in the core module.** `// @branch <name> command=… kind=… envelope=<type|-> tab=<Tab|-> routine=… app=<yes|->`. `-` is the shared mechanism for `--no-envelope`, `--no-tab` and `--no-app`, and the check reports those parts `not needed`. Reasons:
   - The core module is the one file every branch has.
   - The line sits next to the code it describes.
   - It is code, not a registry file, which the brief rules out.
   - It also lets the check compare the declared names (tab, routine) with what the code does.

   A file without the line is a hand-built branch (Scout): every part is expected, and its names are read from its code. Deleting the line therefore makes every left-out part "missing", which the tests rely on to show the marker is read.
2. **The core module may load anywhere after `00_common.js`.** At load time it needs only `TG_KIND_ROUTINE`; everything else (`tgOpenKindRequest`, the env helpers, `tgTripCurrent`, `TG_SLUG_RE`) is called at run time. It takes the next free number in 10–29, then 41–99 (the brief's 1x–2x band has only 27–29 left).
   - `--prefix` accepts any unused 01–99, refusing 00 and a number already used.
   - Under `--force` a branch keeps its own numbers.
3. **The app file loads after `32_app_api.js`** (it writes into `TG_APP_OPS`, defined there): 33–39, then 41–99. The core and app numbers never coincide, because the core's number is taken first.
4. **The routing is set by the branch file at load time**: `TG_KIND_ROUTINE['<kind>'] = '<ROUTINE>'`. `tgKindRoutine` reads the table at call time, so no edit to `00_common.js` and no REQUEST are needed (checked at Step 0).
5. **Names.**
   - Schema: `<pack>-<type in kebab form>.schema.json`.
   - Validators: the type in Pascal case (`tgEnvValidate<Type>`, `validate<Type>Payload`), following the existing `day_versions` → `DayVersions` convention.
   - Identifiers: the name in Pascal case for the other functions; `TG_<NAME>` for the constants.
   - Tab: `<Name>s`, without a second `s` for a name ending in one (`lists` → `Lists`).
6. **Option patterns** (all safe to paste into JS, JSON and HTML without escaping):

   | Option | Pattern |
   |---|---|
   | title | `^[A-Za-z0-9][A-Za-z0-9 ,.()&-]{0,39}$` (`&` is escaped for HTML) |
   | command | the core's own `^/[a-z0-9_]{1,31}$` |
   | kind | `^[a-z][a-z0-9_]{1,31}$` |
   | type | the manifest's identifier pattern `^[a-z][a-z0-9_]{0,39}$` |
   | tab | `^[A-Z][A-Za-z0-9]{0,30}$` |
   | routine | the manifest's `^[A-Z][A-Z0-9_]{0,31}$`, upper-cased |
7. **Placeholder payload:** `{ v?, trip, note }`.
   - Rows are keyed by trip (`id` = the trip's slug), so a re-delivery replaces the row.
   - `note` is ≤ 200 characters.
   - The whole payload is ≤ 40 000 characters, so it fits one Sheet cell under the core's 50 000 cap.
   - The pack validator copies the core helpers' messages word for word. The generated parity test holds the core validator, the pack validator and `schemas/index.mjs validatePayload` to one answer on ten invalid fixtures.
8. **The generator also registers an envelope type in `schemas/index.mjs`** (a `KINDS` entry `'<kebab>': null`, and a `PAYLOAD_KINDS` entry `<type>: '<kebab>'`), inserted before each block's `});`. Reason: `tools/envelope.mjs --pack` refuses any type `validatePayload` does not know, so without the entry the private skill could not stamp its own envelope.
   - After writing, the tool imports the edited module and checks the mapping and the schema load. If that fails, it restores the file and exits 2.
   - The check has an **`envelope tool`** row for this. A hand-built branch whose type is missing from `PAYLOAD_KINDS` (possibly `vegcard`) will show it as missing.
9. **`helper.json` is edited as text.** The type is appended inside `"envelope_types": [...]`, keeping the file's layout: one line, or one item per line with the same indent.
   - The tool checks the result parses to exactly the old manifest plus the type.
   - If it does not, the file is re-stringified and the tool prints a note.
   - Appending is idempotent.
10. **Clashes are read from the loaded pack** (core plus pack files in the GAS harness), not from lists. All of them are reported together, with exit 2:
    - commands: `registryKeys('command')`;
    - kinds: `TG_KIND_ROUTINE` keys, quoted kinds in `tgKindRoutine`'s body (`scout`), and literal `tgOpenKindRequest('…')`;
    - types: core types, an existing handler, `helper.json`, `PAYLOAD_KINDS`;
    - tabs: `allSheetSchemas()`, compared without case, since Sheet tab names ignore case;
    - every global the branch would define: `in ctx`, so the name `trip` clashes on `tgTripGet`;
    - the branch's own files: core and app module, pack folder, schema, test, a non-empty private folder.

    A pack lacking the plumbing a branch calls (`PLUMBING` in the tool) is refused: the tool extends Tour-Guide-style packs only.
11. **`--force` rewrites only a branch this tool wrote** (its core module has its `@branch` line). Its own files are left out of the loaded pack when looking for clashes, and its type may already be listed. A hand-built name such as `scout` is refused even with `--force`.
    - Regenerating with the same options writes identical bytes (tested).
    - Under `--force` with `--no-envelope`, an earlier schema, payload module and `helper.json` entry are left in place, with a printed note: removing them is the owner's decision.
12. **`--no-tab`** writes:
    - no `TG_<NAME>.SHEET`, no `registerSheet` and no store functions;
    - a handler that only tells the owner (with a `TODO (--no-tab)`);
    - app ops that read nothing (an empty list, 404) with a TODO naming where to read from;
    - a header line asking where the data lives.

    The tool never writes the pack's `TG_SHEETS` table (that lives in `21_sheets.js`); a branch's tab name lives in its own `TG_<NAME>.SHEET`.
13. **`--no-envelope`**:
    - writes no schema, no payload module, no validators, no handler and no parity test, and leaves `helper.json` and `schemas/index.mjs` untouched;
    - leaves the pack folder exporting `BRANCH` and `SLUG_RE`, with the fixture holding only the trip;
    - makes the private skill answer with a `reply` (the core's own type).
14. **Check rows and how each is decided** (statuses `ok` / `missing` / `not needed`; exit 0 when complete, 1 when anything is missing, 2 on usage):

    | Row | How it is decided |
    |---|---|
    | core module | `gas/NN_<name>.js`, or the file registering `/<name>` |
    | command | `getCommand` |
    | kind request | a literal `tgOpenKindRequest('<kind>'` |
    | kind routing | a `TG_KIND_ROUTINE` key or a quoted kind in `tgKindRoutine`, and equal to the marker's routine |
    | envelope type | `helper.json` |
    | envelope handler | `getEnvelopeHandler`, and whether it is guarded |
    | core validator | a `tgEnvValidate*` global whose suffix matches the type, ignoring case and `_` |
    | schema | the file exists, parses, and has `additionalProperties: false` |
    | pack validator | an `export function validate*Payload` under the pack folder. Hand-built branches may instead rely on `validatePayload` via `PAYLOAD_KINDS`; marked branches must have their own module |
    | envelope tool | `PAYLOAD_KINDS` |
    | parity test | a file in `tests/` naming both the core validator and the pack validator (or `validatePayload`) |
    | tab | the expression of the core module's `registerSheet` evaluated in the pack, registered, and equal to the marker's tab |
    | app ops | `TG_APP_OPS['<name>.…']` live in the pack |

    Comments are stripped before scanning.
15. **Private drivers.**
    - They import from `../../vendor/helpers/…`, the private repo's layout.
    - They refuse a scratch path inside the working directory.
    - The finish driver prints the exact `envelope.mjs` command with `--in-reply-to <request id>`, plus `--dedupe-key <name>:<request id>` for the branch's own type. The key is per request, not per trip, because a re-run of the same request must not double its answer, while a new request with new content must not be dropped.
16. **Templates** live in `tools/branch-templates/`: `{{KEY}}` values, `{{#FLAG}}…{{/FLAG}}` / `{{^FLAG}}…{{/FLAG}}` sections, innermost first, so `APP` and `TAB` nest. An unknown key or flag throws. The flags are `ENVELOPE`, `TAB`, `APP`. The JSON templates carry no branding line, because JSON has no comments.
17. **Tests run on a copy.**
    - The copy is `<tmp>/helpers` (minus this test file, so its own suite run does not recurse), plus `<tmp>/live-site-pages` only when the repo has one. In the vendored layout there is none, and the tests that read it skip themselves.
    - One copy carries all four shapes (everything; `--no-tab`; `--no-envelope`; `--no-envelope --no-tab --no-app`), so a single suite run covers them all. That run adds about 40 seconds to `node --test helpers/tests/`.
    - The nested `node --test` runs with `NODE_TEST_CONTEXT` removed, so it reports on its own.
    - The only failures allowed on the copy are the three unowned tests that pin the pack's exact type and kind lists (REQUEST R1). Any other failure fails the test.
18. **The private-driver test copies `helpers/` to `vendor/helpers/`; it does not symlink.** `tools/envelope.mjs` compares `process.argv[1]` with its real path to decide whether it runs as the main module, so through a symlink it prints nothing and exits 0. A real private repo vendors a real directory, so nothing changes there; noted in case someone symlinks a checkout.
19. **`--check vegcard` is not run here** (WP-14c builds it in parallel); the coordinator runs it. If `vegcard` lacks a part on purpose, give its core module an `@branch` line with `-` for that part (decision 1).

Developed by: LightAISolutions
