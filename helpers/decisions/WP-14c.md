# WP-14c decisions — the veg card, and the brochure PDF in the app

Every default picked while building WP-14c (TG-PHASE-14.md "WP-14c", Contract C14), with its reason.

## The phrase table
- **The Japanese is the brief's, character for character** (two lines changed later, recorded under "Per-person
  attribution"). The coordinator's task message overrode the brief's "check and record changes": the phrases are the
  content and are copied exactly. Two lines I would suggest, not applied:
  - `avoid.stock` 「煮干し」 → 「煮干しだし」 (the line already says 魚のだし, so it reads fine as is);
  - `avoid.sauces` 「…もだめです」 → 「…も食べられません」 (one register for every "cannot eat" line; だめです is polite enough
    at a counter).
- `vegcard-phrases.json` carries no `Developed by` line (JSON is excepted by the Rules).
- Aliases are exactly the brief's. The diet comes from the table's `diet_values` **and** from `dietFromValues` (the
  travellers kit), the strictest of these and `party.diet` winning, so "animal products" alone still makes a vegan card.

## Composition (vegcard.mjs)
- **Nothing to say → `null`.** No diet, no limit and no English-only value: the routine writes nothing (its silence rule).
- `party.size` is clamped to 1–12; anything that is not a number counts as 1 ("I").
- `country` is trimmed and upper-cased when it is two letters, else `null`. `trip` is set only when it is a valid slug
  (the core refuses the card otherwise).
- Items keep the table's order (meat, pork, beef, poultry, fish, seafood, shellfish, eggs, dairy, nuts, gluten, alcohol),
  not the order the member typed: the fingerprint and the card stay stable.
- Covered limits are dropped: vegetarian covers meat, pork, beef, poultry, fish, seafood, shellfish; vegan also eggs and
  dairy; seafood covers shellfish; meat covers pork, beef and chicken (the README's list).
- `ok` appears only with a diet (the brief: "for any vegetarian or vegan party"). Anything among the extra limits is
  dropped from the fine items, and **noodles are dropped when gluten is a limit** (麺 is wheat by default in Japan).
  Eggs and dairy are fine items only for a vegetarian party that does not avoid them.
- A long "also" list is split into several lines so every line stays ≤ 200 characters (the C14 bound) in both languages.
- English lines start with a capital (the `{items} are fine` template would otherwise start "vegetables are fine").
- `english_only`: trimmed, clipped to 60, de-duplicated case-insensitively, at most 12, in the order given.
- A party with no diet: `avoid` is one line per limit using the item's phrase ("Shellfish (shrimp, crab, clams)."), and
  `ask.contains` lists the first three limits.

## The fingerprint
- Exactly C14: `vcf1:` + FNV-1a 32-bit (lower-case hex) over the UTF-8 of
  `v1|lang or -|diet or -|one/many|extra avoid keys sorted|english_only lower-cased sorted`.

## Per-person attribution (v01.75r)
- **Why:** an owner-reported card merged two travellers' profiles into one voice ("we are …", "we also cannot …")
  although their limits differed. A server reading it would serve the wrong person the wrong thing. The card now says
  each limit for the person who has it.
- **Contract:** `party.members` = [owner, ...companions], each `dietOf()`'s `{ dietary, diet }`. With it `members`
  replaces `dietary` and `diet`; the size is the larger of `party.size` and the member count, and a companion with no
  entry says nothing. Without it the card is exactly as before. No schema, validator or core change: `diet` is the
  strictest, `party` the size.
- **One voice when that is true:** everyone says the same (signature: diet, extra limits, words) → the card as it was,
  "we", byte for byte and with the same fingerprint (a test checks). Only the owner has limits → "I", with `party` the
  real size and the solo card's fingerprint (the card says the same). Nobody says anything → `null`.
- **Groups:** the owner alone; companions who say the same thing as one group, in order of first appearance; a
  traveller with nothing to say is left out. Names: "I"; "my companion" (one companion travels); "all my companions";
  "one of my companions"; "N of my companions" (私は / 連れは / 連れは全員 / 連れの一人は / 連れのうちN人は). 連れ, not
  同行者: it is what a person says at a counter; 同行者 reads like a form.
- **Diet:** the card's diet is the strictest. When every traveller keeps it, "we" say it once. Else the owner opens when
  they keep a diet (a milder one too: the card is the owner's), otherwise the first group with the strictest; every
  other group says its diet ("my companion is vegetarian and does not eat meat, fish or seafood") before its limits
  ("…also cannot have…"). A group with no diet says "… cannot have …", or "… cannot have the following" when its only
  words are English-only. The owner never says a member line ("I is…" cannot occur).
- **ok and ask hold for everyone:** the strictest diet's lines minus every extra limit (never looser for anyone), plus
  one "Does this dish contain …?" for the extra limits the diet's questions do not ask (the first three).
- The fish-stock lines (`avoid.stock`, `avoid.flakes`, `avoid.sauces`) stay right after the intro, unchanged: they
  read for whoever opened.
- **English-only words** carry whose they are ("Me: …", "My companion: …"), clipped to 60 after the label.
- **Bounds:** a per-person card that would break C14 (a section over 12 lines, more than 12 English-only words, the
  8 000-character payload) or a party over 12 is the merged card instead: everyone's values in one voice, stricter for
  each, never looser.
- **Fingerprint:** a per-person card appends `|m:` and its groups' signatures (`o:` or `c<k>/<n>:`, then diet, extra
  limits and words), sorted and joined by `;`: moving a limit to another person changes it, the companions' order does
  not. One-voice fingerprints are unchanged, so an unchanged party is stored silently, not re-sent.
- **Two lines reworded:** `intro.limits` and `avoid.also` say 口にできません / "cannot have" instead of 食べられません /
  "cannot eat": alcohol is drunk, not eaten. The new member lines use the same verb; the diet intros keep
  食べられません (they list foods).

## Rendering
- `vegCardTelegram`: header in bold; for an English-only card an italic line "No local-language phrases for this country
  yet — English only."; a blank line before each section; English-only lines in bold (no italic duplicate); the
  `english_only` list last after "Also cannot eat — show this in a translation app:". The core's renderer is the same
  HTML line for line (a test compares them).
- `vegCardHtml` returns one `<section class="sec sec-vegcard" data-pg="section" data-folio="Veg card">` with
  `data-pg="block"` blocks (the brochure kit's page conventions) and carries its own `<style>` (pass `css: false` when
  the brochure already has it), so the private side can append it as the last page as is.

## Schema and validators
- The slug pattern is the other schemas' (`^[a-z0-9][a-z0-9-]{0,63}$`) so pack and core agree on every slug.
- Order and uniqueness of section ids, `local` null exactly when `lang` is null, and the < 8000-character payload are
  checked in `checkVegCard` (JSON Schema cannot say them) and mirrored in `tgEnvValidateVegCard`.
- **Registering the kind in `schemas/index.mjs`** (not in my owned list): without `veg-card` in its KINDS /
  PAYLOAD_KINDS, `validatePayload('veg_card', …)` and `tools/envelope.mjs --pack tour-guide` refuse the type and the
  shared payloads test fails. The edit is three lines, marked C14; listed as a REQUEST for the coordinator's approval.

## Core
- **Unknown trip:** refused in the registered `validate` (after the payload mirror), so the core's own
  `envelope_rejected` audit and the rejected archive record it; the pure mirror stays free of sheet reads so the parity
  test can run it alone.
- **Send rule:** sent when the envelope answers an open `vegcard` request (checked inside `handle`, before the core marks
  it answered) or when the `fp` differs from the stored one (nothing stored counts as different); otherwise stored
  silently. A `brochure` request's `in_reply_to` does not count.
- `/vegcard` shows the stored card with no footer; any argument other than `rebuild` answers
  "Usage: /vegcard · /vegcard rebuild"; `/vegcard rebuild` always asks, even with a card stored.
- `has_vegcard` reads the tab once per run (the home op asks for every trip) and the cache is cleared on every store.
- The handler is registered only when `veg_card` is in the pinned `helper.json`, so an old pin keeps loading (the card
  is then an unknown type and rejected; `/vegcard` still asks).
- **Dedupe caveat:** the core drops an envelope whose `dedupe_key` it saw in the last 6 h. A `/vegcard rebuild` answered
  with an unchanged card under `vegcard:<trip>:<fp>` would be dropped as a duplicate and the owner would hear nothing.
  REQUEST to the private skill: omit `dedupe_key` (or add the request id to it) when answering a request.

## Morning message
- **Two call sites, not one line:** `tgMorningMessages` returns early for a free day, so the link is added once before
  each `return` (identical lines, marked C14). Without the second one a rest day would never show the card, which is the
  day a party most often eats out unplanned.
- No app link: the morning message's keyboard has no app rows (late / re-plan buttons only), and the brief adds the
  link only where the message already shows them.

## App ops
- `vegcard.get` is a read op (no `write`).
- `brochure.pdf` is a write op (it sends or opens a request). Order: an id outside the folder → 404 `no_brochure` plus
  the audit `tg_app_brochure_outside_root`, before anything is sent or asked; no owner chat → 409 `no_chat` (the app's
  auth answers 403 first in practice; kept as a guard); then the rate limit; then the `/brochure` path itself.
- **The rate limit covers both sends and builds** (one call per trip per minute, script cache), answered 409
  `too_soon` with `retry_after: 60`. Not 429: the app shows its "daily limit reached" screen for every 429.
- A `/brochure` path that neither sent nor opened a request answers 503 `not_sent`.

## App page
- The Veg card is a screen reached only from the home trip row (🥗, shown when `has_vegcard === true`); it is not in
  the nav and not accepted from the launch URL, which keeps the edit to `readParams` and the nav at zero (WP-14b edits
  the same file). Its one hook is the `vegcard: showVegCard` entry in `go()`'s table.
- "Full screen" is a fixed layer over the header and footer, removed by any navigation (Close, the Telegram back
  button, or `go()`); the local text is 26 px serif, the English 15 px beneath; "Hide English" toggles a class and is
  remembered while the app stays open. An English-only card shows no toggle.
- The brochure screen's "📄 PDF" button shows for every trip (the same availability as `/brochure` in the chat). The
  answer is said beside the button: "Sent to the chat", "Building — it arrives in the chat", or the refusal in plain
  words (local texts for `too_soon`, `no_brochure`, `not_sent`; the page's `WHY` table is not edited).
- The page's version file, meta tag and changelog are left for the coordinator.

Developed by: LightAISolutions
