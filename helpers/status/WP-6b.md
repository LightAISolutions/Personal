# WP-6b — kits and pack engines red team (Tour Guide, Phase 6)

> Worker: Fable 5.1 (subagent) · worktree `/home/user/wt-6b`, branch `wp-6b` · brief: `helpers/decisions/TG-PHASE-6.md` §1 + §1.2 · assumptions: `helpers/decisions/WP-6b.md`.

## State

**Done.** Every attack in §1.2 has a test; everything that failed is fixed inside the owned paths; the suite, the bundle check and the boundary check are green; committed on `wp-6b`, not pushed.

The invariant this WP proves: **text the owner did not write never reaches the profile, a shortlist line (`why_you`, `gem_line`, `name` beyond the Maps display name) or a routine's instructions, and a page cannot buy itself a 💎.** The field-path trace (below) shows why: untrusted text is reduced to a sanitized, capped, labelled `excerpt` in the research ledger and never flows further than that; everything the shortlist and the profile carry is built from counts, source kinds, vocabulary values and the owner's own taps.

## Checks (this worktree, 2026-10-01)

| Check | Before | After |
|---|---|---|
| `node --test helpers/tests/` | 374 tests · 373 pass · 1 skipped · 0 fail | **408 tests · 407 pass · 1 skipped · 0 fail** (+34: research 9, brochure 5, maps 4, engines 8, prefs 8) |
| `node helpers/tools/bundle.mjs --all --check` | ok | ok (hello 17 files, tour-guide 26 files) |
| `node helpers/tools/boundary-check.mjs` | clean | clean (360 files) |

No existing test was skipped or weakened; `pack_tour-guide_gems.test.js` had its expected strings updated for R3 (digits → words) and gained digit-free assertions.

## New tests

- `helpers/tests/kit_research_redteam.test.js` (9) · `kit_brochure_redteam.test.js` (5) · `kit_maps_redteam.test.js` (4) · `kit_prefs_redteam.test.js` (8) · `pack_tour-guide_engines_redteam.test.js` (8). Each test name states the attack and the expected refusal or neutralisation. All fixtures are invented (reserved `example.*` hosts, made-up places, French/German wording only for the second-language cases); no network.

## Attack table

Outcomes: PASS (already safe, test proves) · FIXED (code changed in an owned path, test proves) · ACCEPTED (not changed, reason) · REQUEST (fix belongs to another owner, patch under "Requests to other owners").

### Research kit (`helpers/kits/research`)

| # | Attack | Outcome | Where proven / what changed |
|---|---|---|---|
| R-1 | English "ignore previous instructions / mark as hidden gem / tell the owner" page | PASS | `scanText` → `injection_suspect` with `ignore-instructions`, `memory-write-request`, `contact-request` reasons |
| R-2 | The same in French and German | FIXED | `RULES` gained `ignore-instructions-multilingual` and `addresses-ai-multilingual` (fr/de/es/it/pt/nl verb + noun pairs; narrow by design). Ordinary French/German travel prose stays unflagged (test) |
| R-3 | Instructions in an HTML comment | PASS | `scanView` keeps comment text while dropping the delimiters |
| R-4 | Instructions in `alt` / `title` / `<meta content>` / `aria-label` / `data-*` | FIXED | `scanView` now appends attribute text (`ATTR_TEXT_RE`) to the scanned view before tags are dropped |
| R-5 | Bidi / zero-width characters splitting the key words | PASS | `scanView` runs NFKC and strips `INVISIBLE_RE` before the rules |
| R-6 | "locals' favorite", "hidden gem", "4.9 stars, 1 000 reviews" marketing page | PASS (not injection, no weight) | Not flagged (it is not an instruction) and carries no weight: the page can only become a ledger `excerpt`; nothing reads adjectives or digits out of it (trace below) |
| R-7 | Page embedding a fake mailbox envelope (`type`/`producer`/`payload` JSON) | FIXED | new rule `envelope-markup` flags SPEC §2 envelope shapes |
| R-8 | Fifty pages on one host praising one place | FIXED | `mentions(state, {distinct:'publisher'})` keeps one row per publisher key; the gems engine dedupes too (G-2). Skill-side wiring is a REQUEST (Q-1) |
| R-9 | Every attack page in the ledger | PASS | lands as a `fetch` entry with `injection_suspect:true`, a sanitized markup-free `excerpt` ≤ `EXCERPT_MAX` (1000), no field of its own; flagged pages cannot `supports`/`contradicts` a claim, cannot widen a `duration` range, and search snippets are flagged per result |

### Gems engine (`helpers/packs/tour-guide/gems`)

| # | Attack | Outcome | Where proven / what changed |
|---|---|---|---|
| G-1 | Candidate record forged with `gem:true`, `gem_score:99`, `obscurity`, `gem_line`, `why_you`, `labels`, `editorialSummary` | PASS | `normalizeRecord` whitelists fields; `scoreGems` re-derives; projection keys are exactly `['gem','gem_line']`; score identical to the clean record |
| G-2 | Fifty `local_mentions` from one publisher / one ref | FIXED | `normalizeMention` accepts optional `publisher` (≤120, lower-cased); `mentionCount` counts distinct `p:<publisher>` or `r:<ref>`; fifty rows → 1, no 💎, line reads "named by one local-language guide and one local editorial list" |
| G-3 | Mention or review carrying text, HTML or Google fields | ACCEPTED (pre-existing, safe) | `normalizeMention` keeps `{kind, ref, lang?, publisher?}` only; `normalizeReview` keeps `{publish_time, rating, author≤120}` — `author` is never projected or rendered (Chesterton's Fence: pre-existing field, left in place); `editorialSummary`/`generativeSummary`/`reviewSummary` dropped |
| G-4 | `toShortlistFields` → Google digits in `gem_line` | FIXED (R3) | see "R3 report" |

### Brochure kit (`helpers/kits/brochure`) and `brochure-map`

| # | Attack | Outcome | Where proven / what changed |
|---|---|---|---|
| B-1 | `<script>`, `<img onerror>`, `</style>`, `{{…}}`, CSS `url(javascript:)` in names, notes, why-lines, reviews, later and practical text | PASS / FIXED | all text goes through `esc`; attribute emit sites in `sections/cards.mjs`, `sections/cover.mjs`, `mapframe.mjs` now use `attr()` (quote-safe) — FIXED; `javascript:`/`data:text` links dropped — PASS |
| B-2 | SVG route sketch / map overlay with hostile labels | PASS | labels escaped inside `<svg>`; no `<script` or `on*=` inside the SVG |
| B-3 | 5 000-character note | PASS | schema refuses with a JSON-pointer path; a 3 999-char note renders clipped, layout intact |
| B-4 | RTL override / isolate / zero-width characters | FIXED | `esc` strips `DIRECTIONAL_RE` (U+200B–200F, U+202A–202E, U+2066–2069, U+FEFF) so a name cannot flip the line around it |
| B-5 | Image "data URI" carrying a quote or an event handler | FIXED | `images.mjs` `DATA_URI_RE` requires `data:image/(png|jpeg|gif|webp);base64,<base64 only>`; SVG data URIs refused (`SVG_ACTIVE_RE`) |
| B-6 | `brochure-map` `renderPlan` with hostile names, notes, reasons, 5 000-char `why_you` | PASS | escaped (`&lt;script&gt;`), clipped (SHORT 300 / TEXT 4000); the model still passes `kit.validate` |

### Prefs kit (`helpers/kits/prefs`)

| # | Attack | Outcome | Where proven / what changed |
|---|---|---|---|
| P-1 | Evidence reading as an instruction (EN, zero-width, HTML, fake `SYSTEM:`) | PASS | `injectionReasons` patterns 1–9; record `injection_suspect:true`; suspect-only candidate → `held_back` with `suspect_only`; the review card says "excerpt withheld" and the payload carries no attack text |
| P-2 | The same in French / German | FIXED | `INJECTION_PATTERNS` gained pattern-10 (multilingual ignore-instructions) and pattern-11 (multilingual addresses-AI), mirroring the research kit's rules |
| P-3 | Owner confirms a suspect-only candidate | ACCEPTED | the tap is the owner's word; the profile line is the vocabulary value only (`- luxury — confirmed 2026-09-20`, no evidence ids, no excerpt) |
| P-4 | `apply` with a cid that is not held | PASS | skipped with `unknown candidate (no held note and no ledger entry)`; `profile_entries` 0; no ledger entry |
| P-5 | Edit value with HTML | FIXED | `checkValue` refuses `<`, `>` and control characters: `edit value refused: interests: value must be plain text (no < > or control characters)` — refused, not escaped (a profile line must read as the owner's words wherever it is rendered) |
| P-6 | Edit value over the cap (5 000 chars) | PASS | `value longer than 60 chars` |
| P-7 | Edit value with control / zero-width characters | PASS | `readDecisions` → `oneLine` collapses control characters to spaces and `normValue` strips zero-width; the stored value is the visible characters only |
| P-8 | Decisions document: decision outside `confirm|edit|reject|y|e|n`, hostile cid, `source:'reader'`, unknown top-level or item key | PASS | each refused with the exact reason; nothing written |
| P-9 | Hand-edited profile (line added outside the kit) | PASS | `the file is not a prefs-kit profile (no kit trailer); refusing to overwrite it` |
| P-10 | Interview free text | PASS (+ P-5 applies) | text answers are held only (`text answer: held for review`; instruction-like → `held back` as suspect); prose without a legal triple → `unknown key: text`; HTML pick → refused by `checkValue`; over-cap → refused; profile never created |

### Maps kit (`helpers/kits/maps`)

| # | Attack | Outcome | Where proven / what changed |
|---|---|---|---|
| M-1 | Hostile `displayName` (HTML, 5 000 chars), `editorialSummary` with instructions, hostile `websiteUri`/`googleMapsUri`, string `rating` | FIXED | `toSnapshot` now caps via `SNAPSHOT_LIMITS` (`display_name` 300, `address` 500, weekday lines 7×200, urls 2000, `time_zone` 64, `build_id` 120, `place_id` 300), nulls non-`https:` URLs and mis-typed numbers, keeps only the ten content fields; the ledger still counts the call (`units` 1) |
| M-2 | Missing fields | PASS | every content field `null`; `placeEvidence` reads nulls, not text; `toSnapshot` throws without id/buildId |
| M-3 | Poisoned snapshot store (script ids, bad times/locations, non-objects, extra fields, oversize content) | FIXED | `sanitizeSnapshot` on load (`store.rejected` count) and in `put()` (throws `maps: not a usable snapshot record …` when unusable); surviving records validate against `google-snapshot`; purge still runs |
| M-4 | Hostile display names in `placeUrl` / `directionsUrl` | PASS | URL-encoded, one `query_place_id=` |

### Planner / estimator / later / schemas

| # | Attack | Outcome | Where proven / what changed |
|---|---|---|---|
| E-1 | Schemas: Google fields, extra fields, oversize `name`/`why_you`/`gem_line`, text on mentions, oversize snapshot `display_name`, string `rating`, `later` reason > 300 | PASS | `validate(entity, kind)` refuses each with a pointer path; `local_mentions[].publisher` (1–120) added to the place schema for G-2 |
| E-2 | `later` line with HTML reason, hostile slug / place_id / code | PASS | reason stored as data capped at 300 (escaped at render by the brochure kit); non-slug / bad id / bad code throw |
| E-3 | Estimator with a flagged mention and a 5 000-char source title | PASS | flagged mention dropped and its source not cited; title capped 200; hostile `place_id`/category throw |
| E-4 | Planner `normalizeChoices` with HTML slug, unknown key, non-array, unknown place | PASS | refused with a reason each |

## Field-path trace — a research page to the shortlist, the places repository and the profile

Functions named are the ones that touch the value; "stops here" means nothing downstream reads the field.

### 1. Page text → research ledger (`helpers/kits/research`)

1. `ResearchSession.fetch({url, text, excerpt, title, …})` (`lib/session.mjs`) → `run.record(state, 'fetch', input)` (`lib/run.mjs`) → `fetchEntry(id, now, input)` (`lib/ledger.mjs`).
2. `fetchEntry` scans `title + text + excerpt` with `scanText` (`lib/injection.mjs`; `scanView` first strips tags, keeps comment text, appends attribute text, applies NFKC and drops invisible characters) and sets `entry.injection_suspect` / `entry.injection_reasons[].{rule, sample}` (`sample` is sanitized and short).
3. The entry stores only: `url`, `domain` = `registrableDomain(url)`, `publisher` = `publisherKey(url)`, `title` = `sanitizeLine(title, TITLE_MAX)`, `excerpt` = `sanitizeText(excerpt || text, EXCERPT_MAX=1000)` (markup stripped, invisible characters dropped, capped), `supports`/`contradicts` (claim ids — only when not flagged), `source_kind`, `language`, `official`, `page_date`. The full page `text` is **scanned, never stored**. **Page text stops here**: `excerpt` and `title` are the only strings that carry page words, both are labelled untrusted in the run file and the README, and no exported function returns them into another field.
4. `run.mentions(state, {source_kind, language, distinct})` returns rows `{ref, kind, url, domain, publisher, source_kind, language, official}` for **non-flagged** fetch entries and snippet results — no title, no excerpt, no snippet. With `distinct:'publisher'` one row per publisher key. `run.check` / `run.duration` ignore flagged entries entirely.
5. Search results (`searchEntry`) behave the same: `title`/`snippet` sanitized and capped, `injection_suspect` per result, flagged results excluded from `mentions`.

### 2. Research ledger → gems record → shortlist (`helpers/packs/tour-guide/gems`)

1. The skill (`trip-research`, private repo) maps a place to ledger refs and builds `local_mentions: [{kind, ref, lang?, publisher?}]` from `mentions()` rows — refs and tags only, by construction (REQUEST Q-1 asks it to pass `publisher`).
2. `normalizeRecord(raw)` (`gems-record.mjs`) whitelists every field of a candidate record: place identity (`place_id`, `slug`, `name` = the Maps display name, `types`, `location`), Google numbers (`rating`, `rating_count`, `price_level`, `business_status`, `hours`), `streams`, `local_mentions` via `normalizeMention` (`kind` ∈ enum, `ref` ~ `LEDGER_REF_RE`, `lang`, `publisher` ≤120 lower-cased — **no text field exists**), `reviews` via `normalizeReview` (`publish_time`, `rating`, `author` ≤120; review text dropped), `friction`, `chain`, `seed`. Forged `gem`, `gem_score`, `obscurity`, `gem_line`, `why_you`, `labels`, `editorialSummary`, `generativeSummary`, `reviewSummary` are **dropped** (test G-1).
3. `scoreGems(kept, opts)` (`gems-score.mjs`) derives `q` (`qualityScore` from `rating`, `rating_count`), `o` (`obscurityScore` from `rating_count` percentile in the pool), `l` (`localnessScore` from `mentionCount(record, kind)` — distinct publisher-or-ref per kind, so volume on one host counts once, test G-2), `f`, `p`, `gem_score`, `gem = isGem({q,o,l})`. Inputs are numbers and counts only.
4. `toShortlistFields(record, opts)` (`gems-project.mjs`) → `{gem, gem_line}` where `gem_line = gemLine(record, {category_median_count, max})` (`gems-line.mjs`) is built from `ratingBand(rating)` × `peerComparison(rating_count / category_median_count)` (words only — R3), `mentionCount` per kind rendered as "named by two local-language guides …", `seed`, `mass_tourism`, friction words and flag words. `assertNoGoogleFields` guards the projection. **No page text, review text or Google digit can appear in `gem_line`.**
5. `toPlaceFields(record)` → `{gem_score, gem, obscurity, local_mentions:[{kind, ref, lang?, publisher?}], flags, …}` — refs and tags, no text.
6. The skill writes `why_you` and `name` itself: `why_you` is the skill's own words tied to the owner's profile (`place-notes` / `trip-research` SKILL.md), `name` is the Maps display name from the snapshot (capped 300 by `toSnapshot`, M-1). The brief's invariant for these two fields is therefore a skill-prompt rule plus the pack validator's caps; the kits give the skill nothing but the ledger `excerpt` to quote, and the schemas (`tour-guide-shortlist`) refuse Google fields and oversize lines (E-1).

### 3. Shortlist envelope → persistence and rendering

1. The `shortlist` envelope (Drive `from-brain/`, kept in the mailbox archive) is validated by the pack GAS (`validateEnvelope`, WP-6a's scope) and stored by `tgShortlistStore` (`gas/21_sheets.js:390`) as Sheet tab `Shortlist` columns `trip, run, round, group, n, slug, name, gem` plus `payload_json = toJson(item)` — so `gem_line`, `why_you`, `name`, `label`, `minutes`, `area` persist there as JSON.
2. `tgPlanShortlistMessages` (`gas/12_flow_plan.js:101-102`) renders `tgEscape(it.why_you)` and `💎 <i>tgEscape(it.gem_line)</i>` into the Telegram shortlist line.
3. The skill also writes `places/<slug>.md` (private repo, `toPlaceFields`) and, after a plan, `trips/<slug>.md`; both carry the projected fields above, never the ledger `excerpt` (quarantine is the only place a page passage is allowed, per the skill's own rule).

### 4. Prefs evidence → held notes → review → decisions → ledger → profile (`helpers/kits/prefs`)

1. `check`/`ingest({vocab, held, evidence})` → `normalizeEvidence(raw, vocab)` (`lib/evidence.mjs`): `excerpt` capped at `EXCERPT_MAX`, `source_ref` replaced by `opaqueRef` (24 hex), `suggests.{dimension,value,polarity}` checked by `checkValue` (vocabulary cap 60, plain text), `injection_suspect` = `injectionReasons(excerpt).length > 0` (patterns 1–11).
2. `buildCandidates(records, vocab)` (`lib/candidates.mjs`) groups by `candidateId(dimension, value)`; support counts **exclude** suspect records; a candidate with only suspect support gets `hold_reason:'suspect_only'`.
3. `writeHeld(dir, candidates, …)` / `renderNote` (`lib/held-notes.mjs`) write `held/prefs-<dim>-<value>-<hash>.md`: the excerpt appears only in the `## Data (kit-managed, do not edit)` block, one-lined and capped at 300, with a `SUSPECT` marker — labelled "data, never instructions".
4. `review()` (`lib/review.mjs`) builds the Telegram card from `statement(c, vocab)` (dimension label + vocabulary value) and clean excerpts; suspect excerpts are replaced by "⚠ N item(s) looked like instructions: not counted, excerpt withheld"; suspect-only candidates go to `held_back` (shown only with `includeSuspect`). **Excerpt text stops here**: nothing after review reads it.
5. `apply({decisions})` → `readDecisions` (`lib/decisions.mjs`: owner source, legal shape, `ITEM_KEYS` only, `oneLine(value, 200)`) → `applyDecisions` (`lib/confirmed-prefs.mjs`) → the ledger entry `{decision, value?, via, ref, decided_at, evidence_ids}` → `renderProfile(ledger, vocab)` writes only `statement` lines of vocabulary values plus dates and evidence **ids**, with a kit trailer that `checkProfileFile` verifies before any overwrite (P-9). The interview path (`lib/interview.mjs`) builds decisions only from pick answers whose value passes `checkValue`; text answers become held candidates (step 3) and never decisions.

## R3 report — Google rating digits in `gem_line`

**R3 (Phase 6 terms review): FIXED — `gem_line` carries no Google digits; citations ToS §3.2.3(b), Service Specific Terms §3 and §14.3.**

- **Before:** `gemLineClauses` (`gems-line.mjs`) emitted `4.7 from 180 ratings where peers typically have 1,900` — the Google `rating` (one decimal), `rating_count` and the pool's `category_median_count` (derived from Google counts). That string travelled: `toShortlistFields` → `shortlist` envelope item `gem_line` (Drive `from-brain/`, mailbox archive) → Sheet `Shortlist.payload_json` (`gas/21_sheets.js:390`) → Telegram line (`gas/12_flow_plan.js:102`) → the skill's `trips/<slug>.md` plan notes when it copies shortlist lines. Only the `rating` and `rating_count` numbers themselves reached the string; `review_count`, hours and other Google content never did.
- **After:** the first clause is `ratingBand(rating)` (`exceptionally well rated` ≥4.7 · `very well rated` ≥4.5 · `well rated` ≥4.3 · `decently rated` ≥4.0 · `modestly rated` below) joined with `peerComparison(rating_count / category_median_count)` (`by a fraction of the reviewers its peers have` <0.25 · `by far fewer reviewers than its peers` <0.6 · `by fewer reviewers than its peers` <0.9 · `by about as many reviewers as its peers` ≤1.1 · `by more reviewers than its peers`). No `toFixed`, no rating value, no count, no median number. Test: `gemLine({rating:4.7, rating_count:140}, {category_median_count:280})` → `exceptionally well rated by far fewer reviewers than its peers.` and every scored line asserts `/\d/` absent. The gems README Stage 5 bullet is updated (coordinator-authorised README edit); `gems-project.mjs` never mentioned digits. The GAS renderer (`12_flow_plan.js`) was not touched, as instructed.
- **Still persisted elsewhere (by design, within the terms):** `rating`/`rating_count` live only in the Maps snapshot store (`kits/maps`, place_id + lat/lng retention rules) and in the gems scoring inputs in memory; `toPlaceFields` exports `gem_score`, `obscurity` (our derived numbers), never the Google numbers (`assertNoGoogleFields`).

## Requests to other owners

| Id | Owner | Request | Proposed patch |
|---|---|---|---|
| Q-1 | WP-6c / `trip-research` skill (TourGuide) | Pass `publisher` from `mentions(state, {…, distinct:'publisher'})` rows into `local_mentions` so the gems dedupe (G-2) acts on publisher, not only on ref. Until then fifty pages on one host still count once per ref in the gems engine only if the skill calls `mentions` with `distinct:'publisher'`. | In the skill's record step: `local_mentions.push({ kind: row.source_kind, ref: row.ref, lang: row.language, publisher: row.publisher })` for each row of `k.mentions(state, { source_kind, distinct: 'publisher' })`; `SKILL.md` step 6: "mentions as refs only, one per publisher (`distinct: 'publisher'`), carrying `publisher`". |
| Q-2 | WP-6a / `helpers/tests/pack_tour-guide_payloads.test.js` | Line 28 uses a literal `gem_line: '4.7 from 180 ratings where peers average 1,900; …'`. It still passes the schema (free text) and is cosmetic, but a fixture carrying Google digits contradicts R3. | Replace with `gem_line: 'exceptionally well rated by far fewer reviewers than its peers; named by two local-language guides.'`. |
| Q-3 | Architect (docs) | `helpers/status/WP-4d.md:46` and `helpers/decisions/hidden-gems-proposal.md:110` describe the digit form of `gem_line`. Historical records; a one-line note would stop a reader copying the old shape. | Append to each: "Superseded by R3 (Phase 6): `gem_line` is words-only, see `helpers/status/WP-6b.md`." |

## For the architect to decide

- **Brain-written free text (`why_you`, `name`) is enforced by skill prompt and schema caps, not by a kit.** The kits give the skill nothing but the untrusted `excerpt` to quote from, and the schemas cap and type-check, but no code can stop a skill from paraphrasing an excerpt into `why_you`. If a mechanical guard is wanted, the only place is the pack validator (WP-6a, `validateEnvelope`): run `scanText`-equivalent rules over `why_you` and refuse flagged lines. Not implemented here (core/gas is out of scope); flagged as a decision.
- **Review `author` retention (G-3):** `normalizeReview` keeps `author` (≤120). It is never projected or rendered; removing it is a Chesterton's-Fence decision for the gems owner, not taken here.
- **P-3 (owner confirms a suspect-only candidate):** accepted as the owner's word. If the architect prefers, `applyDecisions` could refuse `confirm` on `suspect_only` candidates and require `edit`; one-line change in `lib/confirmed-prefs.mjs`, not made.

## Files changed (owned paths only)

- Research: `helpers/kits/research/lib/injection.mjs` (3 rules, attribute text in `scanView`), `lib/run.mjs` (`mentions` `distinct:'publisher'`).
- Brochure: `helpers/kits/brochure/lib/escape.mjs` (bidi/zero-width strip), `lib/images.mjs` (strict data URIs), `lib/mapframe.mjs`, `lib/sections/cards.mjs`, `lib/sections/cover.mjs` (`attr()` at emit sites).
- Maps: `helpers/kits/maps/lib/maps-snapshots.mjs` (`SNAPSHOT_LIMITS`, `capContent`, `sanitizeSnapshot`, sanitizing store).
- Prefs: `helpers/kits/prefs/lib/evidence.mjs` (patterns 10–11), `lib/vocab.mjs` (`checkValue` plain-text rule).
- Gems: `helpers/packs/tour-guide/gems/gems-line.mjs` (R3), `gems-record.mjs` (`publisher`, distinct `mentionCount`), `gems-project.mjs` (`publisher` projected), `README.md` (Stage 5 bullet, coordinator-authorised).
- Schemas: `helpers/packs/tour-guide/schemas/tour-guide-place.schema.json` (`local_mentions[].publisher`).
- Tests: `helpers/tests/pack_tour-guide_gems.test.js` (R3 expectations) + the five new red-team files.

Developed by: LightAISolutions
