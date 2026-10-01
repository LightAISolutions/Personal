# WP-6a — pack gas red-team + PDF delivery

**State: done.** Every attack A–I has a test. The pack fixes are in `helpers/packs/tour-guide/gas/` (10_commands, 12_flow_plan, 20_envelopes, 30_chat_api, 31_route). Five REQUESTs (R5 optional) and one optional hardening note are listed for other owners (below). Assumptions and defaults: `helpers/decisions/WP-6a.md`.

## Tests
| file | tests |
|---|---|
| `helpers/tests/pack_tour-guide_redteam_envelopes.test.js` (A) | 15 |
| `helpers/tests/pack_tour-guide_redteam_callbacks.test.js` (B) | 9 |
| `helpers/tests/pack_tour-guide_redteam_chat.test.js` (C–H) | 19 |
| `helpers/tests/pack_tour-guide_redteam_pdf.test.js` (I + suite hygiene) | 8 |

- **Full suite:** 374 tests before (373 pass, 1 skipped). Now 425 (424 pass, 1 skipped, 0 fail).
- `node helpers/tools/bundle.mjs --all --check`: ok (tour-guide 26 files).
- `node helpers/tools/boundary-check.mjs`: clean (361 files).
- No existing test was changed or weakened.

## Outcomes
PASS = already safe · FIXED = pack code changed, the test proves it · ACCEPTED = left as is, with the reason · REQUEST = the fix belongs to another owner (patch below).

| # | attack | outcome |
|---|---|---|
| A1 | plan_digest over the pack cap (60 000) | PASS — refused, no message, no row |
| A2 | payload over `ENVELOPE_MAX_PAYLOAD_CHARS`; a string over `ENVELOPE_MAX_TEXT_CHARS` | PASS (core) |
| A3 | wrong types (items, name, days, dates) | PASS |
| A4 | Google fields in shortlist / places_digest / plan_digest | PASS — refused |
| A5 | HTML in every free-text field, also when read back from the Sheet | PASS — escaped |
| A6 | `maps_url` with `javascript:` / `data:` / `http:` | PASS — refused |
| A6b | `https` lookalike or foreign host behind a place name | FIXED — only Google Maps hosts are linked |
| A7 | U+200B / U+202E / U+FEFF / U+2066 / controls in names | FIXED — stripped in all six pack envelopes; core notice/reply → REQUEST R2 |
| A8 | `reply` with `html:true` and `<script>`, an unknown tag, an unbalanced `<b>` | PASS — the core's "can't parse entities" fallback strips the tags and resends (tested). Allow-listing brain HTML → REQUEST R1 (architect) |
| A9 | `drive_file_ids` with an HTML label or an id containing `/` | PASS — refused |
| A10 | profile_summary 1200 / 1201 | PASS — accepted / refused |
| A11 | prefs_review: bad button data, a foreign cid, > 40 items | PASS |
| A12 | created_at 15 days old or in the future | PASS — refused |
| A12b | `in_reply_to` naming no request | ACCEPTED — delivered to the owner only (decision 15) |
| A13 | second envelope with the same `dedupe_key` | PASS |
| A14 | proposal outside the allowlist | PASS (core) |
| A14b | core built-in `drive_create_file` proposal | FIXED — the pack guard refuses it (pack allowlist is empty) |
| A15 | unknown type; trip_facts with extra keys | PASS |
| B1 | `pf:` with a cid never offered; malformed data | PASS |
| B2 | `pf:` ✏️ text after the 30-minute TTL | PASS — not captured |
| B2b | ✅ tap after the TTL | ACCEPTED — still counts (decision 16) |
| B3 | `sl:` with a stale run | PASS |
| B4 | `tf:` with no plan flow | PASS |
| B5 | `ps:` with a stale index or wrong tag | PASS |
| B5b | `ps:` with an unknown plain slug | FIXED — refused |
| B6 | `fl:` with a foreign step id | PASS |
| B7 | `dy:` / `lt:` past the end, negative, non-numeric | PASS |
| B8 | data over 64 bytes, unknown prefix, empty | PASS |
| B8b | extra `:` segments on `pf/sl/tf/ps` | FIXED — strict arity (a `pf:<cid>:y:extra` tap used to decide) |
| B9 | callback from a non-owner or a foreign chat | PASS — ignored, audited once |
| C | interview: HTML, injection text, 300 characters, many values, emoji, empty | PASS — ≤ 5 × ≤ 60, never echoed, only in the `prefs` request; profile untouched |
| D | `< & * _ \`` in names in every renderer and command | PASS — HTML mode, escaped |
| E1 | owner text with `</owner_message>`, `<system>`, `SYSTEM:` | PASS (simple forms) |
| E1b | nested `</owner_</owner_message>message>`, attribute and whitespace tag forms | FIXED — repeated tag strip |
| E2 | API answer with `<script>` / HTML | PASS — escaped |
| E3 | `NEEDS_DEEP` | PASS — Lane C |
| E4 | `CHAT_API_MAX_PER_DAY` | PASS — Lane C, no call, one audit row |
| E5 | 500 / 429 / thrown fetch | PASS — Lane C + cooldown; key redacted everywhere |
| E6 | `/smart on` without a key | PASS — explains, stays off |
| F1 | HTML in the endpoints and in Maps' summary | PASS — escaped |
| F2 | 2 000-character argument, no arrow | PASS — usage line, no query |
| F2b | unknown mode (bike / cycling) | FIXED — refused (was silently routed by transit) |
| F3 | the 201st call of the day | PASS — limit line + link, no query, counter unchanged |
| G1 | plan facts: a 301-character line, the 21st booked line, a dates correction out of order or in the past | FIXED — refused, state unchanged |
| G2 | plan questions: dates out of order, in the past, a 61/62-day span, a 501-character lodging | FIXED (span: PASS) — refused, state unchanged |
| G3 | 11 seeds, an 81-character seed, `/seed` with 11, `/lodging` over 300 | FIXED — refused, nothing stored (all were truncated silently before) |
| H1 | wrong or missing `k` | PASS — "forbidden" |
| H2 | non-owner chat, group, stranger in the owner chat | PASS — silent, audited once per sender |
| H3 | no message, edited_message, channel_post, no update_id, replay, non-JSON, 2 MB body | PASS — OK, no action (the owner's own text-less message gets the core nudge, decision 18) |
| H4 | 10 000-character owner text | PASS — request text capped at 4 000 |
| H5 | unknown doPost / doGet routes, health, wake | PASS — "not found" / health JSON with no secret |
| I1 | reply with `drive_file_ids` | PASS — blob attached, caption escaped, ≤ 1 024 |
| I2 | file over `DOCUMENT_MAX_BYTES` | PASS — link message + `document_too_large` (mock `getSize` overridden per file instance; no harness change needed) |
| I3 | plan_digest `drive.brochure_pdf` | PASS — stored on the trip |
| I4 | `/brochure` + 📄 with a stored PDF | PASS — two resends, zero `brochure` requests, escaped caption |
| I5 | `/brochure` with no stored id | PASS — one `brochure` request |
| I6 | stored file gone | PASS — `document_not_found` + rebuild request, no crash |
| I7 | stored id outside the helper's Drive folder | FIXED — never attached; audit + rebuild request. Core `reply.drive_file_ids` → REQUEST R3 |

## Requests to other owners
> **Architect, at merge (Phase 6):** R1 (`tgSafeHtml`), R2 (`stripHidden` in `core/01_util.js`, used by the pack's `tgEnvClean`), R3 (`driveFileWhere` in `core/09_mailbox.js`, used by the pack's `tgCmdDriveWhere`) and R4 (`createMocks()` resets the harness default; the interim hygiene test removed) are applied on the session branch with tests in `core_telegram.test.js` and `core_mailbox.test.js`; A8 is now FIXED. R5 stays optional (the renderer already links only Google Maps hosts). B2b and A12b stay accepted — `helpers/decisions/TG-PHASE-6.md` §2 and §5.

**R1 — architect / core (`core/09_mailbox.js`, `core/05_telegram.js`): allow-list brain HTML for `reply` with `html:true`.**
Today the text is sent raw. Telegram refuses an unknown tag, and the core's fallback then resends it as plain text, so that case is safe. But a tag Telegram accepts goes through as the brain wrote it, for example `<a href="https://lookalike.example">`.
```diff
--- core/09_mailbox.js (reply handle)
-    var html = p.html ? p.text : tgEscape(p.text);
+    var html = p.html ? tgSafeHtml(p.text) : tgEscape(p.text);
--- core/05_telegram.js (new)
+/** Brain HTML → Telegram's tag set: escape everything, then re-open the plain tags and https links. */
+function tgSafeHtml(s) {
+  return tgEscape(String(s))
+    .replace(/&lt;(\/?)(b|strong|i|em|u|ins|s|strike|del|code|pre|blockquote|tg-spoiler)&gt;/g, '<$1$2>')
+    .replace(/&lt;a href="(https:\/\/[^"<>\s]{1,400})"&gt;/g, '<a href="$1">').replace(/&lt;\/a&gt;/g, '</a>');
+}
```
An unbalanced tag still reaches Telegram's 400, and the existing fallback handles it.

**R2 — core (`core/09_mailbox.js`): strip invisible and bidi characters from `notice` and `reply` text**, as the pack now does for its own envelopes.
- Best done by moving the pack's set into core as a shared helper (`stripHidden`), which the pack would then call:
```js
var HIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F؜​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g;
function stripHidden(s) { return String(s).replace(HIDDEN_CHARS, ''); }
```
- Then in the `notice` and `reply` validate: `if (typeof p.text === 'string') p.text = stripHidden(p.text);`. Validate and handle share the same object, so this is enough.

**R3 — core (`core/09_mailbox.js`): `reply.drive_file_ids` attaches any file the owner can open.** The brain lane can name any Drive id, and the script runs as the owner. Proposal: move the pack's `tgCmdDriveWhere(id)` into core as `driveFileWhere(id)` → `'in' | 'outside' | 'missing'` (walk ≤ 8 parent levels up to `getRootFolder()`), then:
```diff
       Object.keys(p.drive_file_ids).forEach(function (label) {
         docs++;
+        if (driveFileWhere(p.drive_file_ids[label]) === 'outside') { auditFail('document_outside_root', p.drive_file_ids[label], { label: label }); return; }
         var d = tgSendDocument(chat, { driveFileId: p.drive_file_ids[label], caption: tgEscape(label), silent: true });
```
Once it lands, the pack's `tgCmdBrochure` would call `driveFileWhere` instead of its own copy.

**R4 — test owner (`helpers/tests/tools_bundle.test.js`) or harness owner: the bundle test's envelope depends on the previous file's clock.** `H.envelope()` dates envelopes from the latest `loadGas()` clock. When a 2027-clock test file runs just before it, the envelope is refused as "in the future" (it passes alone).
- Interim workaround: the last test in `pack_tour-guide_redteam_pdf.test.js` resets the harness clock to wall time.
- Proposed fix:
```diff
-  H.putEnvelope(state, H.envelope('greeting', { name: 'bundle' }), 'g.json', 'Hello');
+  H.putEnvelope(state, H.envelope('greeting', { name: 'bundle' }, { created_at: new Date().toISOString() }), 'g.json', 'Hello');
```
- Alternative, in the harness: have `createMocks()` reset `_last`, so `envelope()` falls back to `Date.now()`.

**R5 — WP-6b / schema owner (`kits/*/schemas`), optional: pin `maps_url` to Google Maps in the brain-side schemas**, so a lookalike URL is refused at the source and not only shown unlinked:
`"pattern": "^https://((www\\.)?google\\.[a-z.]{2,8}/maps|maps\\.google\\.[a-z.]{2,8}/|maps\\.app\\.goo\\.gl/|goo\\.gl/maps/)"`

**Optional hardening, no finding — core router:** drop `callback_query.data` over 64 bytes before dispatch. Telegram never sends such data, and the pack already treats it as inert (B8).

## For the architect to decide
- R1, whether to allow-list brain HTML (the brief left this to the architect).
- B2b, whether a `prefs_review` batch itself expires after its TTL.
- A12b, whether a `reply` with an unknown `in_reply_to` should still reach the owner.
- The attribution line: the brief says Fable 5.1; this session's notice says Opus 5.5, which is what the commit uses.

Developed by: LightAISolutions
