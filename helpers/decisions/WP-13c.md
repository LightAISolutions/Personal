# WP-13c decisions — core: stays, stale plans, messages, Scout's raw text and group

Every default this work package picked, with its reason. Contract: C13 in `helpers/prompts/TG-PHASE-13.md`.

## A11 — cutting HTML (item 5)
- Reproduced: `tgLines` sliced a 10-link line at 200/333/517/700/901 characters inside an `<a href>` tag (test
  `pack_tour-guide_p13c_html.test.js`, first test, failed before the fix).
- New pack helper `tgHtmlClip(html, max)` in `gas/00_common.js`: tokens are a whole link (`<a …>…</a>`), a tag, an
  entity, a surrogate pair or one character; tokens are kept while the text, '…' and the closers of the tags still open
  fit in `max`. A link that does not fit is dropped whole and the cut stops there (later text is not pulled forward, so
  the line never reads out of order). A tag opened right at the cut is dropped instead of wrapping only '…'.
- Used by `tgLines` (every message the pack builds through `tgCmdMessages`) and by the bookings reminder card
  (`tgBkCard`, which used the core's `tgClip`). The core's own `tgClip` / `tgSplit` stay as they are: `tgSplit` closes
  and reopens tags across chunks (a link split across two messages stays two valid links), and `tgClip` only runs in
  `tgEdit` on messages the pack already built at ≤ 3900 characters, so the core never cuts pack HTML. No `helpers/core`
  change was needed.

## A2 — /dates refusals (item 3)
- Reproduced: `/dates <date> end <place> 10:30` on a day running from 09:00 was refused with no hint (test
  `pack_tour-guide_p13c_dates.test.js`, first test).
- `tgCmdDatesHint` (`gas/10_commands.js`) appends one valid command to every day-length refusal (the per-day forms and
  the trip-wide `/dates hours`). Which side moves: the side the owner did not just type. After `end` or `hours` the end
  is kept and the start moves to three hours before it (two when three would cross midnight); after `start` the start is
  kept and the end moves to three hours after it (at most 23:59). When that side cannot make two hours (an end before
  02:00, a start after 21:59) the other side moves. Three hours, not two, so the suggestion still leaves room for a stop;
  the brief's example (`hours 07:30 10:30`) is the same rule.
- A side governed by the day's own start or end point is moved with its own command and the owner's words
  (`/dates <date> start <their place> <time>`), because `hours` does not override a point. Every hint is tested by
  sending it back: the day is then saved.

## A10 — one reminder on the travel day (item 4)

- Root cause reproduced: with a trip zone ahead of home (an invented UTC+5 trip, UTC-8 home), the trip's midnight falls
  after 09:00 at home, so `tgOwnerTz` flipped to the trip zone mid-day and the daily reminder ran again at 09:00 trip time
  on the same home day (two reminders 11 h apart).
- Fix in two parts, both in the pack:
  1. `tgOwnerTz` takes the owner to be at the trip once the trip's **first day starts**, not at its midnight. The start
     is that day's own start point time, else its `day_start`, else the trip's hours `day_start`, else 09:00, in the trip
     zone (`tgTripFirstStartMs`, `tgTripOwnerThere`). The owner is still taken to be there until the end of the last day.
     `tgTripInProgress` is unchanged because other callers (the current trip, `/review`) judge dates, not presence.
  2. A guard: a daily reminder never goes within 12 h of the previous one (`tg_bk_daily_at`). A due time inside the gap
     moves to the same hour on a later day (not just delayed to last + 12 h), so the owner keeps one fixed hour.
     The search is capped at three days ahead.
- `/bookings now` is exempt from the guard (the owner asked) but records its time, so the next scheduled reminder
  honours the gap.
- Changed test: `pack_tour-guide_gas_trip_tz.test.js` (a GAS test this WP owns) — 08:00 on the first day is now home;
  the assertion moves to 09:00. Marked "A10".

## Scout's words (item 7) and the 🔁 mark (coordinator addition)

- `/scout` sends `ctx.text`, the message exactly as typed (including a `/scout@Bot` form and the owner's spacing); the
  core's usual request-text cap applies. The old `'/scout ' + truncate(args, 200)` is gone.
- An app scout passes no text, so `tgScoutOpen` writes `/scout <what> in <where>` with the **resolved** where (the
  current trip's destination when the owner left it blank), so the engine always finds a place in the words. No suffix.
- `tgScoutParse` is kept unchanged: it still words the acknowledgement and fills `query`, `where`, `destination` and
  `trip`. Its separator order (the last " in ", then " near ", "@", ",") is the one the engine follows (WP-13d).
- A `seen_before` label shows as 🔁 after 💎 and 🌱 on the ranked chat line. The label was already in the schema and
  validators, so no validator change was needed. The pack README documents the engine's new inputs, as the coordinator
  asked (the text describes WP-13d's code; nothing of it is imported here).

## Stays (item 1, B4 core half)

- **Where.** Every form lives in `gas/26_lodging.js` (`tgLgCmd`); `/lodging` in `10_commands.js` only delegates. The
  lodging module already held the re-plan offer, so stays, the C13 check and the fingerprint sit next to it.
- **Storage.** `trip.lodging = { text, nights?, stays: [{ text, from, to }], set_at }`. With stays, `text` is one line per
  stay ("Reed Inn: 2 nights, 2027-06-10 to 2027-06-12; …") and `nights` their sum, so every old reader (the chat
  context, the app's `trip.digest`, the replan reason) still shows something true. `/lodging clear` stores
  `{ text: '', stays: [], set_at }`: every reader treats an empty text as "no lodging".
- **Date words.** YYYY-MM-DD, `today` and `tomorrow` (the trip's own day, as `/replan`) and `day N` (N = 1 is the trip's
  first day; refused in plain words while the trip has no dates). The separator may be `to`, `→`, `–` or `-`.
- **Overlap.** Nights overlap when `a.from < b.to && b.from < a.to`; a check-out on another stay's first night is not an
  overlap. Every overlapping stay is replaced and named. The 12-stay cap is checked after the replacement, so a wide
  stay that swallows three is allowed at the cap.
- **The first dated stay replaces the undated words** and the reply quotes them; undated words while stays exist are
  refused with the dated form and `clear`.
- **The undated form** keeps its 300-character bound and wording; it now strips hidden characters and records `set_at`
  (C13's stale rule needs it). Two existing tests compared the stored object exactly and now include `set_at`, marked
  "B4": `pack_tour-guide_gas_commands.test.js` (a GAS test this WP owns) and `pack_tour-guide_phase12_rehearsal.test.js`
  (no WP of this phase owns it; it broke because of B4's `set_at`).
- **Listing.** Each stay with its nights; "No stay yet for the night(s) of …" in runs of dates (trip nights are
  start … end − 1); "⚠️ outside the trip's dates" on a stay with any night before the start or a check-out after the end.
  A trip without dates shows neither.
- **Sending.** `tgTripUpdateOf` adds `lodging` (the whole list) once a stay is set, only when `tgLgCheck` passes, so a
  hand-edited row past 12 stays is never sent. After `clear` nothing is sent, because C13 requires 1–12 items: see the
  REQUEST in the status file.
- **The research line** (`tgCmdLodgingText`) is the stays summary. The plan flow's research request puts the stays first
  and its own lodging words after them, never overwrites the stays, and allows 3000 characters with stays (12 × 200
  plus the nights) instead of 500.
- **`/route hotel`** picks tonight's stay (`from ≤ today < to`), else the first stay, else the undated words.
- **The offer** (`tgLgOffer`) takes an optional first date: after an add or a remove it offers the planned days from that
  stay's first night (and from the trip's today) on. `clear` makes no offer: with no lodging a re-plan has nothing to
  aim at, and the tap would answer "No lodging is saved".

## Fingerprints and stale plans (item 2)

- **The hash.** `tgLgFnv` is FNV-1a 32 (offset 0x811c9dc5, prime 0x01000193, `Math.imul` and `>>> 0`) over UTF-8 bytes
  made by hand in `tgLgUtf8` (the core has no TextEncoder; `Utilities` has no plain UTF-8 byte call the harness mirrors).
  A lone surrogate encodes as U+FFFD (EF BF BD), as Node's `Buffer` does, so the test compares against an independent
  BigInt FNV over `Buffer.from(s, 'utf8')`.
- **Normalisation.** Exactly C13: `from|to|text` per stay, text lower-cased with JavaScript's `toLowerCase`, every run
  of whitespace (`\s+`, tabs and NBSP included) collapsed to one space, trimmed; stays in `from` order; joined by `\n`.
  No Unicode normalisation (NFC/NFKD) and no accent folding: C13 does not ask for it and the routine never recomputes it.
  Without stays, the undated text alone; no lodging (or an emptied one after `/lodging clear`) → no fingerprint.
- **Test vectors.**
  - `tgLgFnv('')` = `811c9dc5`; `tgLgFnv('a')` = `e40c292c`.
  - Stays `[{ text: 'Gull  Hōuse 漢 😀 ', from: '2027-06-12', to: '2027-06-15' }, { text: ' Reed\tINN', from: '2027-06-10',
    to: '2027-06-12' }]` normalise to `"2027-06-10|2027-06-12|reed inn\n2027-06-12|2027-06-15|gull hōuse 漢 😀"` →
    **`lfp1:0b6769ef`**.
  - Undated `'  Old  MILL, 3 nights '` → `'old mill, 3 nights'` → **`lfp1:6ae58148`**.
- **The stamp.** `tgOpenKindRequest` stamps `lodging_fp` on `plan` and `replan` only, in one place, so every opener
  (the chat, the app, the replan offer, the plan flow) carries it. A caller's own `lodging_fp` is always deleted first:
  only the core computes it. No lodging → no field.
- **Where the fingerprints live.** Settings `tg_req_lodging` (request id → fp, the newest 60; a plan request is
  answered within hours, and 60 covers a long burst of re-plans) and `tg_plan_lodging` (trip slug → `{ fp, at }`,
  written when a `plan_digest` is stored, part digests included because the parts path re-enters the same handler).
  Settings, not a sheet column: no Trips or Digests schema change, and an old core ignores them.
- **Which fingerprint a plan has.** The digest's own `lodging_fp` wins; else the request's (`in_reply_to`); else `''`
  with the arrival time. A well-formed value that is not the core's own is accepted and simply shows the line (the
  core never trusts it for anything else); a malformed one refuses the whole digest like any other bad field.
- **Stale with neither fingerprint.** Stale only when the lodging's `set_at` is later than the digest's arrival. A plan
  stored before this phase has no record at all: it is stale only when the lodging has a `set_at`, which exists only
  for lodging saved after this phase was deployed, hence after that plan arrived. Lodging without `set_at` → no line.
- **When the line shows.** Only while a stored day is today (the trip's own day) or later — a finished trip never nags.
  It names the first such date in `/replan <date> <why>`. Placement: the day card and the morning message right under
  their header, `/trip` right before its list of days. The line is never in the app (the brief asks for Telegram's
  three places).
- **Clear** sends no `trip_update.lodging` (C13 needs 1–12) but does change the fingerprint to none, so a plan built
  for stays shows the line after `clear`: it was built for lodging the owner removed.

## Scouted candidates (item 8)

- **Storage.** The Places tab gains `scouted` as its last column; the cell holds `'true'` or `''`. A cell reads as
  scouted when it is `true` or the text `true` in any case (Sheets may turn the text into a boolean). `tgShPlaceOut` adds
  `scouted: true` only when marked, so every old row and every unmarked place comes out exactly as before, and the app's
  row keys are unchanged for them. `tgPlacesUpsert` runs `_tgEnsureCols` once per digest, so a tab made before C13 gains
  the column on the next places digest (setup is not re-run on deploy).
- **Leaving the group.** A place leaves when a places digest lists it without the mark. A digest that does not list it
  at all leaves the mark alone: a `check` digest answers only the places the owner asked about, so absence says nothing.
  A change of the mark alone counts as `verified` (the row is updated; the owner is not told "changed").
- **Validation.** The core's places validator accepts `scouted` as an optional key and refuses any value but `true`;
  the pack schema says `const: true`. Unknown keys are still refused by both.
- **`/places`.** The overview adds " · 🔎 N scouted" to a destination that has any, then the group
  "🔎 Scouted, not chosen yet" with one line per candidate (destination, area), at most 20, and "… and N more" after.
  The core trusts the routine's mark and does not filter by status. A search puts scouted hits after the others under
  the same header; the numbers and buttons follow that order. Nothing changes when no place is scouted.
- **The app.** `places.search` and `places.get` add `scouted: true` on a scouted place only. The Places screen moves
  scouted rows of the page it got after the others, under an `h3` with the same words; the server's order and the
  24-row cap are untouched. Only `scouted === true` counts.
- **Tests outside my paths.** `pack_tour-guide_gas_sheets.test.js` (a GAS test this WP owns) lists the Places columns
  and now ends with `scouted`, marked "WP-13c item 8".

## A16 parity (item 6)

- **How.** `pack_tour-guide_p13c_parity.test.js` walks each of the ten payload schemas for every free-text string (a
  string with no pattern, enum, const or format; `$ref` and `anyOf` followed, arrays by their first item), sets it in a
  full example payload, and runs the pack validator and the core's registered validator (the hidden-character cleaning,
  then the mirror) side by side. Lengths: the bound and one past it; the minimum and one under it when it is above 1;
  2000 units for a field with no bound. Each in kanji (1 unit), an emoji (a surrogate pair, 2 units) and e plus a
  combining acute (2 units). About 380 probes; a probe whose parent the example lacks is skipped.
- **Result.** No difference: both sides count UTF-16 units (`String.length`) — the brochure kit's subset validator for
  the schema's `maxLength`, `tgEnvStr` for the core. Nothing needed fixing. JSON Schema itself counts code points; the
  pack follows its own subset validator, which both the routine's `envelope.mjs` and the tests use, so the two lanes
  agree with each other, which is what matters for an envelope being accepted.
- **Strings with a pattern** (slugs, dates, ids, URLs) are left out: a kanji or an emoji never matches them on either side.
- A mutation (one core bound lowered by one) makes the test list each differing field, so it is not vacuous.

## Docs (item 9)

- **`helper.json`** has no command list (commands live in `gas/10_commands.js` and the pack README), so it needed no
  change; its payload schemas are referenced by file and the C13 fields live in those files.
- **SPEC** gains the §5 paragraph "Stays and stale plans" (forms, storage, `trip_update.lodging`, the fingerprint, the
  stale rule and line, `scouted`, Scout's words) and a §16 ownership row for WP-13c, placed before the coordinator row;
  the Phase 12 lodging-offer sentence now says a dated stay list travels as `trip_update.lodging`.
- **Pack README** updates the `plan_digest` and `places_digest` rows, the `00_common`, `21_sheets` and `26_lodging` file
  rows, adds a Phase 13 paragraph after "Trip days", and lists the new tests.

Developed by: LightAISolutions
