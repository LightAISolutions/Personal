# WP-14f — decisions (the Takeout fetch)

Brief: the coordinator's WP-14f brief (Phase 14, after WP-14d and WP-14e). Every default picked while building, with
its reason. Contract and caps for readers: `helpers/packs/tour-guide/lists/README.md` "Fetching the export".

## The route (`?route=takeout`, `gas/28_lists.js`)
1. **The route lives in the pack, not the core.** It reads the owner's own Takeout folder, which only Tour Guide's lists
   branch needs; `registerRoute` is the core's door for exactly this. A core without the module answers a POST to an
   unregistered name with `404 not_found`, which the client reports as `not_deployed`.
2. **Auth is the request's upload key, as for `?route=upload`.** It is already in every request file the routine reads,
   it is scoped to one request, and it expires with it (24 h old, or 60 min after the answer — the same
   `REQUEST_MAX_AGE_HOURS` and `UPLOAD_AFTER_ANSWER_MIN` the upload route uses, so the routine has one rule to learn).
   No new secret, no Script Property.
3. **Only `lists` and `research` requests may read exports** (`TAKEOUT_KINDS`). `lists` is the sync itself;
   `research` because the private side also looks for a newer export when trip research runs (WP-14d). Any other kind's
   key is refused `wrong_kind`: a reply to a message has no business reading the owner's archives.
4. **The refusal order** is the brief's. The cheap shape checks come before the HMAC, the HMAC before any Sheet read,
   so an unauthenticated caller learns nothing about which requests exist.
5. **Audit.** After the key checks out a refusal is audited with the request id (`takeout_refused`); before it, at most
   once per 6 h per reason (`seenOnce('takeout:refused:'+reason)`), so a stranger hammering the route cannot grow the
   AuditLog. Every successful get is audited `takeout_get` with the part's name and size, never its bytes.
6. **Where exports are looked for:** every non-trashed folder named `Takeout` in My Drive's root, its files and the
   files of its direct subfolders. Takeout's "Add to Drive" writes to `Takeout/`; some accounts get a dated subfolder.
   Deeper folders are not walked (a bounded Drive scan per call). Trashed files are skipped (the Drive mock already hides
   them from `getFiles`; the real code checks `isTrashed()` anyway).
7. **The name pattern** `takeout-<YYYYMMDDTHHMMSSZ>[-<1–3 digits>]-<1–4 digits>.zip|.tgz`, case-insensitive. The
   middle number is a **tolerance, not something seen**: some exports reportedly carry an extra counter between the
   stamp and the part number. I have not seen such a name in a real export; it is an untested inference. Accepting it
   costs nothing, and if it means two exports made in the same second, the group key keeps them apart. Anything else
   (`.tar.gz`, `.7z`, other names) is ignored.
8. **Group key** = the stamp (uppercased) plus, when present, `-` and the middle number zero-padded to 3. Plain string
   comparison then sorts exports correctly (`…Z-002` < `…Z-010`), and the key is what the daily job stores as seen.
   Exports sort newest first by stamp, then by middle number descending; at most 3 are listed (the newest is what is
   read; two more help the owner see that an older one is still there).
9. **A duplicate part name keeps the first file found.** Drive allows two files with one name (a re-run of "Add to
   Drive", a copy). A get names a part by name only, so one of them has to win; the first found is stable for a given
   folder and the export still reads whole. The second never shows.
10. **`created`** is the earliest creation time among the export's parts (ISO), `''` when Drive gives none. `bytes` is
    the sum of the parts' sizes.
11. **Caps.** A part over 10 MB is refused on get (`413 too_large`): Apps Script holds the blob and its base64 (4/3
    larger) in memory, and the answer has to fit the web app's response. An export over 30 MB, or with any part over
    10 MB, is flagged `too_large` in the list so the client and `/lists` can say so before trying. At most 10 gets per
    request (cache key `takeout:n:<id>`, 6 h, the dedupe TTL): an export has a handful of parts; ten is room for a retry.
12. **`lock: false`.** The route changes no state the lock protects (it never writes to Drive or the Sheet). The only
    write is the get counter in the cache; two gets racing could both pass at 9 — an 11th get is harmless.
13. **It never writes to Drive.** A test snapshots the Drive tree (minus the helper's own mailbox) before and after a
    list and gets, and asserts it is unchanged.

## The daily job and the chat
14. **The daily job opens a request only after a first answered sync** (`tgListsLastRead()` non-empty, i.e. a `lists`
    request has been answered at least once). Before that, nobody has shown the routine side answers the kind: an
    automatic request every day into a routine that is not set up would only produce stale requests and acks. The
    owner's first `/lists sync` is the opt-in; `/lists auto off` is the opt-out (setting `lists_auto`, on by default).
15. **The check order** is off → never_synced → none → seen → open → opened. "Seen" comes before "open" so a day with
    nothing new reports `seen` even while a request happens to be open — the more useful answer in the job log.
    Never while a `lists` request is open (one at a time; the open one will read the newest export anyway).
16. **"Seen" is the group key in `lists_takeout_seen`**, set when the job opens a request and when `/lists sync` opens
    one with an export. A manual sync of the newest export therefore stops the job from opening a second request for it.
17. **The automatic request** is `{ trip?, takeout, auto: true }`, its text "/lists sync (a new export in Drive)" and its
    ack "📋 A new saved-lists export is in Drive — reading it…" (with " for <trip>" when a trip rides along), so the
    owner knows why a request appeared that they did not send.
18. **Errors.** The job runs in try/catch, audits `tg_lists_takeout_error` and returns `error`; one bad day of Drive
    never breaks the other daily jobs.
19. **`/lists sync` with no export in Drive sends the export steps and opens nothing** — a request the routine cannot
    answer would only time out. **When Drive cannot be read** (an error, audited), the request is still opened without a
    `takeout` stamp: that is exactly what `/lists sync` did before WP-14f, and the routine may still find the export by
    its own path.
20. **`/lists` lines.** "Newest export in Drive: <date in the owner's zone>, <size>" (KB rounded, at least 1 KB; MB with
    one decimal), " — too large to read" when flagged; or a one-line how-to when there is none; nothing when Drive cannot
    be read (the rest of the message still shows). The auto line appears only once a request has been answered, for the
    same reason as decision 14 — before that there is nothing automatic to report.

## The client (`lists/lists-fetch.mjs`)
21. **Mirrors `tools/upload.mjs`**: curl (so the environment's proxy applies), `-L` for the Apps Script redirect, the
    body and the answer in temp files that are always deleted, curl's own error output swallowed. `keyFrom` is imported
    from `tools/upload.mjs` rather than copied, so the "read the key from the saved request" rule has one home. The
    key is never printed: errors never carry the request body, and an unknown argument is echoed only when it looks like
    a flag (a stray value might be a key). A test greps stdout and stderr for the key.
22. **Not re-exported from `lists/index.mjs`.** The engine stays pure (`node:zlib` only, no child processes); the
    routine imports the tool by path or runs it as a CLI.
23. **The client checks the answer itself.** It re-sorts the exports newest first (a stable sort on the stamp), and an
    export with a bad stamp, no parts, or a part name that does not match the pattern or contains `/` or `\` makes the
    whole answer `bad_answer` — the name becomes a file name in `--out`, so it must never be a path.
24. **Order in `fetchTakeout`:** `no_export` → `not_newer` (with `--newer-than`, the routine's last read stamp) →
    `too_large` → the gets. Nothing is created in `--out` until there is something to write. Each part is checked twice:
    the decoded length and the answer's `bytes` must both equal the listed size (`size_mismatch`). A failure part-way
    removes the parts this call wrote, so `--out` never holds half an export.
25. **The export-size cap is client-side only.** The core enforces the per-part cap on get; the export flag is advice
    the client honours (`too_large` without fetching). Enforcing 30 MB in the core too would need the whole export's
    state per request; the per-part cap already bounds each call.
26. **Reasons.** The core's refusal reasons pass through when they look like reasons; the router's `404 not_found` maps
    to `not_deployed`; anything unparsable is `bad_answer`; a transport that throws is `network`.
27. **Exit codes** 0 fetched (or listed), 2 nothing to fetch (`no_export`, `not_newer`), 1 a failure or bad arguments —
    so a routine can branch without parsing (2 is normal and quiet).

## Reading an export in parts (`readSavedExports`)
28. **One shared read state.** `readSavedExport` became `readState` → `readInto` → `readDone`, and `readSavedExports`
    runs `readInto` once per part on the same state. One part therefore gives exactly `readSavedExport`'s result (a test
    deep-compares them, with and without limits, and for an unreadable part).
29. **A list merges only into a list from an earlier part.** Within one part, lists behave exactly as before (two CSVs
    with one name stay two lists, as WP-14d reads them), which is what keeps decision 28 exact. Across parts, a name
    already read is appended to in part order; `truncated` sticks once any part's list was cut.
30. **The lists, items-in-a-list and items-in-all limits hold for the whole export**; a merged list counts once against
    `lists`, and a part's items count against the merged list's room. The unpacked-size limit (50 MB) holds **per part**:
    Takeout cuts parts at a size the owner chose, and a whole-export cap would refuse a perfectly normal three-part
    export of the same total a single part may have.
31. **Once the lists or items-in-all limit is reached, later parts are not read** and each is named in `skipped`
    ("<why>: not read", `partial`), rather than inflating archives whose lists could not be kept anyway.
32. **`skipped` is concatenated in part order; `partial` is true when any part was partial.** A damaged part keeps the
    other parts' lists and is named; `partial` then stops the merge from untagging anything.

## Compare: the cut before the lookups
33. **`compareCut` is exported unchanged** (with a `= {}` default for its options), from `scout-rank.mjs` and
    `scout/index.mjs`. A routine comparing a long saved list can cut it to ten on the bare records (`{ place_id }`,
    with `in_where` and `listed_on`) before spending lookups on places the board would drop. A test checks that the cut
    on bare records keeps the same places `rankScout` keeps from the full ones.
34. **`already_cut`** (compare mode only) is added to `more`, so the board still says how many places were left off. A
    non-negative integer, else 0 (a string, a fraction, a negative, NaN or Infinity count as 0); scout mode ignores it, so
    scout boards stay byte-identical (the WP-14e pin still passes).

## Tests
35. **The Drive mock gained real bytes** (additive): `DFile.getBlob().getBytes()` returns signed bytes, as Apps Script
    does, when a file was made with `bytes`; `putTakeout(state, name, bytes, { folder, trashed, created })` puts one.
    Existing files behave as before.
36. **Fixtures are invented**: stamps in 2027, the town of Quillmere and Brindlewick, made-up request ids; the fetch tests
    run a fake curl on `PATH`, so nothing touches the network.
37. **`C14f`**: three `/lists sync` calls in `pack_tour-guide_lists.test.js` (WP-14d's) now need an export in Drive, so
    each gets one `putTakeout` line marked `C14f` — the smallest change that keeps their meaning.

Developed by: LightAISolutions
