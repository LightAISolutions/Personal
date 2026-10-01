# Prefs kit

The connector-reader pattern (build plan §5) as a small, generic library and CLI:

```
evidence  ──ingest──▶  held notes (quarantine)  ──review──▶  owner taps ✅ / ✏️ / ❌  ──apply──▶  confirmed profile
(from a reader)        one note per candidate          prefs_review payload            decisions doc       + decision ledger
```

The owner's interview answers take a shortcut through the same pipe: `interview` holds them as evidence and confirms
each pick with an owner decisions document it builds from the answers, in one call.

Nothing reaches the profile without the owner's recorded decision. The kit reads no connector, calls no network, sends
no message and keeps no clock; every path is a caller-supplied argument. It is not travel-specific: the vocabulary of
what a preference can be comes from the caller, and the travel vocabulary ships as the `travel` preset.

## Commands

```
node helpers/kits/prefs/index.mjs check  --vocab V <evidence.json>
node helpers/kits/prefs/index.mjs ingest --vocab V --held DIR [--profile F | --ledger F] <evidence.json>
node helpers/kits/prefs/index.mjs review --vocab V --held DIR (--profile F | --ledger F) [--max N] [--include-suspect]
node helpers/kits/prefs/index.mjs apply  --vocab V --held DIR --profile F [--ledger F] <decisions.json>
node helpers/kits/prefs/index.mjs interview --vocab V --bank B --held DIR --profile F [--ledger F] [--now ISO] [--max N] <answers.json>
```

From a private repo the path is `vendor/helpers/kits/prefs/index.mjs`. Always name `index.mjs`: Node does not run a
directory's `index.mjs`, so `node helpers/kits/prefs/ …` fails.

| Option | Meaning |
|---|---|
| `--vocab V` | a preset name (`travel`) or a vocabulary JSON file |
| `--bank B` | `interview` only: a preset name (`travel` → `presets/travel.interview.json`) or a question-bank JSON file |
| `--now ISO` | `interview` only: the decision time when the input is not a request envelope (an envelope's `created_at` always wins) |
| `--held DIR` | where held notes live — in a private repo, a directory under `quarantine/` |
| `--profile F` | the confirmed profile (Markdown) the kit owns; e.g. `profile/travel-prefs.md` |
| `--ledger F` | the owner-decision ledger; default `<profile without .md>.decisions.json`, beside the profile |
| `--max N` | review items per batch, 1..20, default 8 (`review` and `interview`) |
| `--include-suspect` | also show held-back candidates (suspect-only, tied, low support), clearly labelled |
| `--min-support N` | clean pieces of evidence a candidate needs before it is proposed, default 1 |
| `--salt-env NAME` | environment variable whose value salts source-ref hashes (default `PREFS_REF_SALT`; unset = no salt) |

Output is JSON on stdout. Exit codes: `0` ok · `1` a finding (invalid evidence, refused decisions, a decision skipped
for a reason other than "already applied", a refused profile write, a rejected interview answer, a refused answers
file) · `2` usage.

## Inputs

**Vocabulary** (`presets/travel.vocab.json` is the worked example):

```json
{"v":1, "name":"travel", "title":"Travel preferences", "max_tokens":2000,
 "dimensions":[{"id":"pace", "label":"Pace", "cardinality":"one", "values":["relaxed","normal","packed"]},
               {"id":"food", "label":"Food", "cardinality":"many", "hint":"cuisines, dishes, ways of eating"},
               {"id":"mobility", "label":"Mobility", "cardinality":"many", "polarity_labels":{"+":"ok with","-":"avoid"}}]}
```

`cardinality:"one"` dimensions hold a single value from a closed `values` list (confirming a rival replaces it);
`"many"` dimensions hold any number of values (≤ 60 characters), each liked (`+`) or avoided (`-`) — free values, or
only those of a closed `values` list when it has one. `max_tokens` (200..20000, default 2000) caps the rendered profile.
Two optional keys per dimension: `examples` (open dimensions only: starter values an interview may offer as buttons;
the dimension stays open) and `default` (what a consumer may assume when the owner never answered: a value for `one`,
`[{value, polarity}]` for `many`; a default is never written to the profile — only decisions are).

The `travel` preset (`max_tokens` 3000):

| Dimension | Holds | Values |
|---|---|---|
| `pace` | one | relaxed · normal · packed |
| `interests` | many | open — kinds of places (museums, historic sites, viewpoints …) |
| `food` | many | open — cuisines and dishes; `-` = rather not |
| `budget_band` | one | shoestring · moderate · comfortable · luxury |
| `mobility` | many | open — walking range, stairs, access; `+` ok with / `-` avoid |
| `crowds` | one | avoid · tolerate · enjoy |
| `day_rhythm` | one | early · flexible · late |
| `must_avoid` | many | open — hard noes; `+` never / `-` fine with |
| `climate` | many | heat · cold · humidity · rain · altitude · wind · long sun exposure; `+` fine with / `-` avoid |
| `activities` | many | open — things to do, beyond `interests`' kinds of places |
| `dietary` | many | open — `-` = cannot eat |
| `spice` | one | mild · medium · hot |
| `meal_style` | many | street food · markets · cafes · sit-down · fine dining · cooking class · bars |
| `lodging` | many | open — kinds of places to stay and what matters in them |
| `companions` | one | solo · partner · family with kids · friends · group |
| `planning_style` | one | scheduled · loose · mixed |
| `free_time` | one | little · some · lots |
| `transport` | many | open — `+` happy to use / `-` avoid |
| `languages` | many | open — `+` speaks / `-` does not speak |
| `gem_appetite` | one | 1 … 5 (1 = stick to the famous, 5 = rather eat where the neighbourhood eats); default 3 |
| `off_track_minutes` | one | 10 · 25 · 45 · 60 (how far beyond the day's plan a hidden gem may pull); default 25 |
| `rough_edges` | many | cash-only · no-english-menu · queues · no-reservations · standing-room; `+` tolerates / `-` avoid; default tolerates cash-only and no-english-menu |

Values are normalised (lower case, diacritics stripped): "Cafés" is stored as `cafes`.

**Evidence** — one record per signal a reader found, as a JSON array, `{"evidence":[…]}` or JSON Lines:

```json
{"source_kind":"gmail", "source_ref":"<whatever lets the reader re-find it>", "date":"2026-05-14",
 "excerpt":"<short quote>", "suggests":{"dimension":"food", "value":"street food", "polarity":"+"},
 "injection_suspect":false}
```

`source_kind` is one of `gmail calendar drive takeout seed owner-chat`. Unknown keys refuse the record. At ingest the kit:
replaces `source_ref` by an opaque 24-hex hash (salted when a salt is set), so no message, event or file id is stored;
sanitises the excerpt (HTML tags, control and zero-width characters stripped; e-mail addresses and long digit runs
masked; one line, ≤ 280 characters); and scans the raw text for instruction-shaped content. A hit sets
`injection_suspect` with the matching pattern ids; a reader's own `true` is kept; the kit never clears the flag.
The excerpt is data only — what a record says comes from `suggests`, never from its text.

**Decisions** — the only input that changes the profile. Either a document the core writes from the owner's taps:

```json
{"v":1, "kind":"prefs_decisions", "source":"owner", "via":"telegram",
 "decisions":[{"cid":"c_44af72c063", "decision":"confirm", "decided_at":"2026-09-20T10:04:00Z"},
              {"cid":"c_552a750eda", "decision":"edit", "value":"small museums", "decided_at":"2026-09-20T10:05:00Z"},
              {"cid":"c_52d61c9dc3", "decision":"reject", "decided_at":"2026-09-20T10:07:00Z"}]}
```

or a core `request` envelope (SPEC §2) whose `payload.kind` is `prefs_decisions` (its `id` is kept as the decision
ref). `y | e | n` are accepted for `confirm | edit | reject`. Any malformed item, unknown key, a `source` other than
`owner`, or an envelope type other than `request` refuses the whole document. The kit cannot prove who wrote a file:
callers pass it only a file the core wrote, never anything assembled from mail, documents or web pages.

**Question bank** (`presets/travel.interview.json`; schema `schemas/travel.interview.schema.json`, draft 2020-12
subset checked with the brochure kit's validator) — the questions the core asks, grouped in sections:

```json
{"v":1, "vocab":"travel", "title":"Travel preferences interview",
 "sections":[{"id":"pace", "title":"Pace & rhythm", "questions":[
   {"qid":"pace-01", "text":"How full should a typical sightseeing day be?", "kind":"scale", "dimension":"pace",
    "options":[{"label":"Relaxed", "value":"relaxed", "polarity":"+"}, {"label":"Packed", "value":"packed", "polarity":"+"}],
    "skip_ok":true}]}]}
```

`kind` is `pick` (one tap), `multi` (any number of taps), `scale` (one tap on an ordered row) or `text` (free text,
`options: []`). Every option maps to exactly one `{dimension, value, polarity}`: the question's dimension, the option's
value and polarity. `validateBank(bank, vocab)` adds what the schema cannot say: the bank names this vocabulary; section
ids and qids are unique; a qid is `<section id>-NN`; every dimension exists; every option value is legal (closed lists
enforced); a single-value dimension is offered with `+` only; text questions have no options and closed ones at least
two. Section ids are short slugs (`/interview <section>` revisits one). Labels ≤ 24 characters, question text ≤ 200.
The travel bank has 39 questions in 13 sections — pace & rhythm · food · activities · climate · mobility · crowds &
timing · budget · lodging · companions · must avoid · planning style · hidden gems · past favourites (text) — every
one `skip_ok: true`. A text question's `dimension` is where the caller usually files the answer, not a constraint.

**Interview answers** — written by the core from the owner's taps:

```json
{"version":1, "answers":[{"qid":"pace-01", "dimension":"pace", "value":"relaxed", "polarity":"+", "kind":"scale"},
                         {"qid":"favourites-02", "dimension":"food", "value":"night markets", "polarity":"+", "kind":"text"}]}
```

`interview` accepts three shapes, detected by shape: that object; a request payload carrying it as `interview` (other
payload fields ignored); or the core's whole `request` envelope (SPEC §2) whose `payload.interview` holds it — then
the envelope's `created_at` is the decision time and its `id` the decision ref (`interview:<id>`). Without an envelope,
`--now` gives the decision time; the kit keeps no clock, so one of the two is required. `kind` is `pick`, `multi`,
`scale` (all three are taps: picks) or `text`. Up to 200 answers. An answer with an unknown key, an unknown dimension
or a value its dimension refuses is left out and reported in `rejected`. A text answer counts only when the caller has
already turned it into `{dimension, value, polarity}`; prose without that is rejected — the kit never parses prose.
An answer that does not match the bank (unknown qid, kind or option) is applied anyway and reported in `warnings`:
the triple is what the owner tapped; the bank only cross-checks it.

## Outputs

- **Held notes** — `DIR/prefs-<dimension>-<value>-<cid6>.md`, one per candidate (a dimension + value). Readable
  Markdown (statement, status, support and conflicts, each piece of evidence with suspect ones labelled) plus a
  kit-managed JSON block holding the evidence (newest 50 per candidate). Rewritten only when their content changes.
- **Review payload** (`review`, read-only) — `{v:1, kind:"prefs_review", vocab, batch_id, items, held_back, more}`.
  Each item has plain `text` (≤ 1200 characters; the core HTML-escapes it) and one row of buttons with
  `callback_data` `pf:<cid>:y|e|n` (≤ 64 bytes). Up to 20 items; the payload stays under 65 536 characters.
- **Ledger** — `<profile>.decisions.json`: every decision per candidate with its history, the suggested and final value,
  `decided_at`, `via`, the decision ref and up to three clean evidence ids. Rejections live here, so a rejected
  candidate is never proposed again, whatever new evidence arrives.
- **Profile** — Markdown rendered from the ledger alone, one `## <Label>` section per dimension, each line with its
  provenance (`— confirmed 2026-09-20 · evidence e_…` or `— edited 2026-09-20 from "museums" · …`), and a trailer
  `<!-- prefs-kit profile v1 · vocab <name> · body sha256 <16 hex> -->`.
- **Interview result** (`interview`) —
  `{ok, errors, decided_at, ref, applied, already, held, rejected, superseded, warnings, review, profile_summary, profile_entries}`:
  - `applied` — picks confirmed now `{index, qid, kind, cid, dimension, value, polarity, decided_at, effective}`;
    `already` — the same for picks a previous run already recorded (a re-run reports them here and changes no file).
  - `held` — answers that stay held `{…, reason}`: text answers, and picks not saved (suspect, or other clean evidence
    ties or outvotes them, or a single-value dimension seen only negatively).
  - `rejected` — `{index, qid, reason}`; `superseded` — `{index, qid, by}` (within one file the later pick wins: on a
    single-value dimension any earlier `+` pick, on a many-value one an earlier pick of the same value);
    `warnings` — `{index, qid, warning}` for answers that do not match the bank.
  - `review` — the `prefs_review` payload above, built from this interview's held candidates only.
  - `profile_summary` — plain text (no HTML, no Markdown), ≤ 1 200 characters, for `/profile`: a count line, then one
    line per dimension (`Pace: relaxed`, `Climate: avoid altitude, heat`), cut at a line with `+N more`.

## Rules the kit enforces

1. Nothing reaches the profile without an owner decision record; `ingest` and `review` never write it.
2. Suspect evidence is never counted as support. A candidate whose only evidence is suspect is held back; shown only
   with `--include-suspect`, labelled, with the suspect excerpts withheld.
3. Proposals need a clear stance: tied evidence, too little support, or a single-value dimension seen only negatively
   is held back with a reason. Decided candidates are not re-proposed.
4. Re-running is idempotent: ids are content hashes, notes and files are rewritten only on change, a decision already
   recorded is skipped as "already applied".
5. The latest decision (by `decided_at`) is a candidate's state; older ones are kept as history.
6. An edit keeps its provenance: suggested value, owner value, date, ref and evidence ids.
7. The profile stays under the vocabulary's `max_tokens` (estimate: characters / 3.5); an over-cap result is refused
   before anything is written. A profile edited by hand, or written for another vocabulary, is never overwritten.
8. **Decisions remain the only input that changes the profile — the interview included.** `interview` holds every
   legal answer as `owner-chat` evidence (`source_ref` `interview:<qid>`, hashed like any ref), then builds an owner
   decisions document (`source: "owner"`, `via: "telegram"`, one `confirm` per pick, `decided_at` = decision time +
   the answer's index in milliseconds) and applies it with the ordinary `apply`. Text answers are never confirmed.
9. **The answers file has the same trust as a decisions document**, because the core wrote it from the owner's taps.
   Callers pass only a core-written file (the `to-brain/req_*.json` or its payload), never anything assembled from
   mail, documents or web pages. Even so, its values are scanned like any evidence: a pick that looks like an
   instruction is not saved, and other clean evidence that outvotes a pick sends it to review instead.

## Caps

| Cap | Value |
|---|---|
| excerpt | 280 characters after sanitising |
| value | 60 characters |
| source_ref | 200 characters (stored as a 24-hex hash) |
| evidence per held note | newest 50 |
| decisions per document | 50 |
| review items | 20 (default 8), 1200 characters each, callback_data ≤ 64 bytes |
| review payload | 65 536 characters |
| profile | `max_tokens`, default 2000 (travel 3000) |
| interview answers | 200 per file |
| question bank | 20 sections, 12 questions each, 12 options each; label 24, text 200 characters |
| profile_summary | 1 200 characters |

## What it never does

Read Gmail, Calendar, Drive or any other source; call the network; send or draft messages; write outside the paths it
is given; clear an `injection_suspect` flag; treat excerpt text as instructions; overwrite a profile edited by hand.

## Dependencies

None: Node 22 built-ins only (`node:fs`, `node:path`, `node:crypto`, `node:url`), plus the brochure kit's JSON Schema
subset validator (`../brochure/lib/validate.mjs`, imported, not copied) for the question bank.

## Library

`import * as prefs from './index.mjs'` exposes `check`, `ingest`, `review`, `apply`, `interview` (alias `runInterview`;
same options as the CLI, as an object: `{vocab, bank, held, profile, ledger?, answers, now?, salt?, minSupport?, max?,
includeSuspect?}`) and the building blocks (`loadVocab`, `validateVocab`, `normalizeEvidence`, `buildCandidates`,
`buildReview`, `readDecisions`, `applyDecisions`, `renderProfile`, `loadBank`, `validateBank`, `loadBankSchema`,
`readAnswers`, `profileSummary`, …). Fixtures: `fixtures/evidence-sample.json` (invented trip evidence with one planted
injection), `fixtures/decisions-sample.json` and `fixtures/interview-answers-sample.json` (invented answers: picks, a
superseded pick, text answers, one planted injection, one prose-only answer and one unknown dimension).

Developed by: LightAISolutions
