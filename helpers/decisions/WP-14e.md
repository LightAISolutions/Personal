# WP-14e — decisions (Compare, and the core half of one Discover routine)

Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14e" (items 12 and 16), Contract C14 wave 2. Every default picked while
building, with its reason.

## The Discover routing
1. **`TG_DISCOVER_KINDS` is checked first in `tgKindRoutine`, and only when `routineConfigured('DISCOVER')`.** Without a
   Discover routine (or with its URL but no token) every kind goes exactly where it went before: Scout to `SCOUT` when
   set, else `RESEARCH`; every other kind by `TG_KIND_ROUTINE`, else the inbound routine. The list is a plain array a
   later branch can `push` to from its own file; `tgKindRoutine` reads it at call time.
2. **`--discover` writes a guarded push**: `if (TG_DISCOVER_KINDS.indexOf('<kind>') < 0) TG_DISCOVER_KINDS.push('<kind>');`
   right after the module's `TG_KIND_ROUTINE` line. The guard keeps a kind once even when `00_common.js` already lists
   it (as with `compare`). `29_compare.js` carries the same two lines by hand, and a test checks that they match what the
   template writes.
3. **The `discover routing` row is never `missing` unless the `@branch` line says `discover=yes`.** Discovery is
   optional, so a branch without the line (Scout) or without the key is `ok` when its kind is listed and `not needed`
   when it is not. A listed kind on a line without the key gets a note in the detail, not a failure. The row sits right
   after `kind routing`, and its detail names the file that adds the kind.
4. **`--discover` on a pack without `TG_DISCOVER_KINDS` is refused (exit 2).** The list is not added to `PLUMBING`, so
   such a pack still takes branches without the flag.
5. **Without the flag the bytes are unchanged.** Every addition sits in a `{{#DISCOVER}}` section:
   - the header line, the `@branch` key and the push in the core module;
   - `discover: true` in `BRANCH`;
   - a README row;
   - a test of its own in the branch's test file, so the existing tests keep their bytes.

   I checked this twice. The generator's output for the four existing shapes (41 files, with `--private-out`) has the
   same sha1s before and after the change. And a test renders every template without the flag and compares it with the
   template minus its DISCOVER sections.
6. **The routing test pins the declaration, not the run-time list.** `00_common.js` declares the four kinds. At run time
   the list starts with those four, in order, and any extra entry must be a kind some module pushes from its own file,
   listed once. Before this change the test pinned the exact run-time list, which made the whole-suite-on-a-copy run fail
   on the `--discover` branch.

## The payload and the validators
7. **The pairing rules live in the schema's root `anyOf`**, because the validator subset has no `if`/`then`. This leaves
   `checkScout` untouched:
   - the scout alternative forbids `source`, item `flags` and the `not_found` reason;
   - the compare alternative requires `mode` and `source`.

   The core validator mirrors the rules, with its own messages.
8. **Flag uniqueness is not enforced.** The subset has no `uniqueItems`, and the core would need the same rule for
   parity. The engine never repeats a flag (one per screen).
9. **`flags` appears only when non-empty, and only on compare boards.** An item with no warning carries no key, so a
   compare board's clean items look like a scout board's.
10. **The `source` bounds match the command's**: names are 2–4 strings of 1–120 characters, a list name 1–80.

## The engine
11. **The group is `opts.group`, else the pool's majority**: food when more than half the places are food (`groupOf`).
    A dinner list is food and a museum pair is activity, without the driver having to say so.
12. **The diet screens and the vegetarian labels apply to food places only**, judged per record (`groupOf`). A list that
    mixes a temple with three restaurants does not get a `diet` flag on the temple.
13. **The cut happens before ranking**, as the brief orders it. The driver marks each record:
    - `in_where` (true when the place is in `where`, else in the trip's destination);
    - `listed_on` (an ISO date, compared as a string; undated sorts last).

    Ties keep pool order.
14. **Names the driver could not find** come in as `not_found`. They lead the left-out list with `place_id: null`, so the
    owner sees first which named places are missing.
15. **`query` is always `compareQuery(source)`** ("compare: …", clipped to 80). Any `query` the caller passes is ignored
    on a compare board, so the card, `/scouts` and the board agree.
16. **The why line** reads "On your list <name>" or "One of the places you named", in place of the topic sentence.

## The command
17. **` in ` is read only in the last comma part**, at its last occurrence. In `/compare Inn by the Lake, Pear Press in
    Quillmere` the first name keeps its "in"; only the last part names the place.
18. **List names match folded**: lower case, accents stripped, spaces squeezed. The owner's words may also start with
    "my ". The request carries the list's own spelling from `tgListNames()`.
19. **One argument that is no list gets the usage line.** It is not treated as a single name, because comparing one
    place is not a comparison.
20. **No trip is required.** The current trip is attached when there is one; a list can be compared before a trip
    exists.
21. **`tgListNames` is called only through `typeof tgListNames === 'function'`, inside `_safe`.** Before WP-14d merges,
    or if the function throws, there are no lists: a list request gets the usage line, while names still work.

## The core, the board and the app
22. **The compare card names what it left out** (each place with its reason). The owner named these places, so a silent
    count would hide which one was missing. A scout card is unchanged.
23. **The Scouts tab gains `mode` and `source_json` at its end.** An older sheet gets them on its first store
    (`_tgEnsureCols`). A scout board leaves both blank, and a blank `mode` reads as `scout`.
24. **The app heads (`scout.list`, `scout.get`) are unchanged for scout boards.** `mode` and `source` are added only to a
    compare board, so the pinned key list of a scout head still holds.
25. **`/scouts` counts "places" on a compare board and its button reads ⚖️.** A scout board keeps "picks" and 🔎.
26. **On the board, compare mode:**
    - the topic bar is gone, and each card has its "⚠️" lines;
    - the compare table gains a Warnings column;
    - the diet line reads "Checked for <diet>" (not every place has to pass, so "Every pick has something …" would be
      false);
    - the page `<title>` is the board's title.
27. **The app's warning lines use an inline style** with the page's `--danger` colour. The Scout screen has no warning
    class, and the brief keeps the page's other screens untouched.
28. **`not_found` gets the words "not found" in each map** (`TG_SCOUT_LEFT_WORDS`, `SCOUT_LEFT`, `REASON_TEXT`). Every
    other word stays as it was.

## Docs
29. **The pack README.** The brief's Docs line names "Discover routing" in the pack README, so I added that section and
    a Compare paragraph in the Scout section, and nothing else. The `gas/` table row for `29_compare.js` is a REQUEST:
    WP-14d's `28_lists.js` row goes in the same place, and the coordinator merges both.

Developed by: LightAISolutions
