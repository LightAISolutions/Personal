# WP-6a — decisions and assumptions (pack gas red-team + PDF delivery)

Brief: `helpers/decisions/TG-PHASE-6.md` §1 and §1.1. Outcomes per attack are in `helpers/status/WP-6a.md`.

## Process
1. **Attribution lines.** The brief names `Co-Authored-By: Claude Fable 5.1`; this session's own attribution notice names `Claude Opus 5.5` (same `Claude-Session` line). The commit uses the session's notice. The architect may amend it at merge.
2. **"A chat message produced by a refused input is a finding"** is read per input source. A refused **envelope** must produce no chat message at all (only the core's audit row and the `archive/rejected` move); every A test asserts this. A refused **owner input** (chat text, a command, a tap) is expected to get one short line saying why (the brief's F and G ask for "a polite refusal" or "rejected with a message"). That line is not a finding as long as it does not echo the hostile input raw.
3. **No core, harness, SPEC or README edits.** Everything outside `helpers/packs/tour-guide/gas/` that should change is a REQUEST with a patch in the status file.
4. **Fixtures** are invented ("Harbor Town", `fixture…` Drive ids, `placeholder-claude-key-for-redteam-tests`). No network: the Messages API, Maps and Telegram are the harness mocks or stubs set on the vm context from the test file.
5. **Suite hygiene.** `H.envelope()` dates envelopes from the most recent `loadGas()` clock. Once the red-team files sorted between the older pack tests and `tools_bundle.test.js`, that test's envelope was dated 2027 and refused as "in the future" (it passes alone). The last test of `pack_tour-guide_redteam_pdf.test.js` (alphabetically the last `loadGas` user) loads `hello` with no fixed clock, which resets the harness clock to wall time. The proper fix belongs to the test or harness owner and is REQUEST R4.

## Pack fixes: defaults chosen
6. **Invisible and bidi characters (A7)** are **stripped** from every string of the six pack envelope types at validation time, in place, before handle() sees them. They are not refused, because a stray U+200B should not cost a whole digest.
   - Set stripped: C0 controls except `\t \n \r`, DEL and C1, U+061C, U+200B, U+200E/F, U+202A–U+202E, U+2060–U+2064, U+2066–U+2069, U+FEFF.
   - Kept on purpose: U+200C and U+200D (ZWNJ/ZWJ), which emoji sequences and some scripts need.
   - Core `notice` and `reply` are not covered: REQUEST R2.
7. **Maps links (A6).** The schema keeps accepting any `https://` URL, so refusing a foreign host would drop the whole envelope. The renderer links only Google Maps hosts and shows any other URL unlinked:
   - accepted hosts: `www.google.<tld>/maps`, `google.<cc>`, `.co.<cc>`, `.com.<cc>`, `maps.google.*`, `maps.app.goo.gl/`, `goo.gl/maps/`
   - the URL must be ≤ 400 characters
   - a lookalike such as `google.com.example.net` or `google.com@example.net` is not linked
8. **Proposals (A14).** The pack manifest's `action_allowlist` is empty, so the pack now refuses every proposal through `registerProposalGuard('tg_pack_allowlist')`. That includes the core built-in `drive_create_file`, which the core allowlist would otherwise accept. A later pack action must be added to the manifest's list to pass.
9. **Callback arity (B8).** `pf:`, `sl:`, `tf:` and `ps:` data with the wrong number of segments answers "Unknown button" and does nothing. Before, extra segments were ignored and the tap acted. `dy:` and `lt:` ignore extra segments harmlessly (tested) and were left alone.
10. **`ps:` keys (B5).** A plain slug key must match `^[a-z0-9][a-z0-9-]{0,63}$` and must be either a stored place or a slug on the last `/places` list. An unknown slug answers "That list has changed — search again." instead of opening a notes request for an invented place.
11. **Plan inputs (G): refuse, never truncate silently.**
    - Limits: added or corrected fact lines ≤ 300 characters, question answers ≤ 300, `/lodging` ≤ 300; ≤ 10 seeds per message, each ≤ 80 characters; ≤ 40 fact lines; ≤ 20 booked lines (the research schema's `maxItems`).
    - Dates must be two dates in order, start no earlier than local today, span ≤ 60 days.
    - Each refusal re-shows the same step with a ⚠️ line and leaves the flow state unchanged.
    - The brief's "lodging of 501" is refused by the 300 cap. 300 was chosen so `/lodging` and the plan question agree.
    - A ✏️ correction of a dates fact is date-checked only when it contains an ISO date, so free-text corrections ("early May") still go through.
    - Booked lines the brain itself sends beyond 20 are still cut to 20 in the research payload (`slice(0, 20)`, as before). The cap is enforced against the owner's own additions.
12. **`/route` modes (F).** A trailing `bike`, `bicycle`, `bicycling` or `cycling` is answered "I can route by walk, transit or drive — not …". Before, the word was silently routed as part of the destination by transit. Side effect: a place whose name ends in one of these words needs an explicit mode after it (`… Cycling walk`). Accepted.
13. **Lane B framing (E).**
    - The owner text has every opening and closing `owner_message` or `trip_context` tag removed. The removal repeats until nothing changes (nested `</owner_</owner_message>message>`), is case-insensitive and also takes attribute and whitespace forms.
    - `<system>` and `SYSTEM:` are not stripped. They stay plain text inside the single owner block, and the fixed system prompt already says that block is a question, not instructions.
    - Unchanged: the context JSON still escapes `<` as `<`.
14. **Brochure resend (I).** `/brochure` and the 📄 button attach the stored PDF only when it sits inside the helper's own Drive folder.
    - The check walks up from the file at most 8 parent levels, with at most 20 parents per level.
    - A file outside the folder is never attached: an audit row `tg_brochure_outside_root` is written and a rebuild (`brochure`) request opens, so the owner still gets a brochure.
    - A missing file still goes through `tgSendDocument`, so its `document_not_found` audit is kept, and then falls back to the rebuild request as before.
    - The same check for the core's `reply.drive_file_ids` is REQUEST R3.

## Accepted (not changed)
15. **A12 — reply with an unknown `in_reply_to`.** A `reply` whose `in_reply_to` names no request is still delivered to the owner chat. It can only reach the owner, and the core cannot tell a pruned request from an invented one.
16. **B2 — taps after the TTL.** A ✅/❌ tap on a live `prefs_review` batch counts after the 30-minute TTL. The TTL covers only the ✏️ capture of the next text. Late text after an expired ✏️ goes the normal way (a `message` request), and a closed batch refuses further taps. The architect may decide to expire the batch itself.
17. **C — interview answers.** Answers are never echoed back (stronger than "echoed escaped"). Hostile owner text such as "ignore previous instructions" travels as data in the `prefs` request (≤ 5 values × ≤ 60 characters per text question). It is the owner's own words; the prefs kit treats it as owner text and `tg_profile_summary` is written only by the brain's `profile_summary` envelope.
18. **H3 — owner messages with no text.** The owner's own text-less message (a sticker or photo with no caption) gets the core's nudge "I only read text here". Every other non-message update shape is silent.

Developed by: LightAISolutions
