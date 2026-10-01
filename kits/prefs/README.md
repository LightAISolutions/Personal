# Prefs kit

The connector-reader pattern (build plan §5) as a small, generic library and CLI:

```
evidence  ──ingest──▶  held notes (quarantine)  ──review──▶  owner taps ✅ / ✏️ / ❌  ──apply──▶  confirmed profile
(from a reader)        one note per candidate          prefs_review payload            decisions doc       + decision ledger
```

Nothing reaches the profile without the owner's recorded decision. The kit reads no connector, calls no network, sends
no message and keeps no clock; every path is a caller-supplied argument. It is not travel-specific: the vocabulary of
what a preference can be comes from the caller, and the travel vocabulary ships as the `travel` preset.

## Commands

```
node helpers/kits/prefs/index.mjs check  --vocab V <evidence.json>
node helpers/kits/prefs/index.mjs ingest --vocab V --held DIR [--profile F | --ledger F] <evidence.json>
node helpers/kits/prefs/index.mjs review --vocab V --held DIR (--profile F | --ledger F) [--max N] [--include-suspect]
node helpers/kits/prefs/index.mjs apply  --vocab V --held DIR --profile F [--ledger F] <decisions.json>
```

From a private repo the path is `vendor/helpers/kits/prefs/index.mjs`. Always name `index.mjs`: Node does not run a
directory's `index.mjs`, so `node helpers/kits/prefs/ …` fails.

| Option | Meaning |
|---|---|
| `--vocab V` | a preset name (`travel`) or a vocabulary JSON file |
| `--held DIR` | where held notes live — in a private repo, a directory under `quarantine/` |
| `--profile F` | the confirmed profile (Markdown) the kit owns; e.g. `profile/travel-prefs.md` |
| `--ledger F` | the owner-decision ledger; default `<profile without .md>.decisions.json`, beside the profile |
| `--max N` | review items per batch, 1..20, default 8 |
| `--include-suspect` | also show held-back candidates (suspect-only, tied, low support), clearly labelled |
| `--min-support N` | clean pieces of evidence a candidate needs before it is proposed, default 1 |
| `--salt-env NAME` | environment variable whose value salts source-ref hashes (default `PREFS_REF_SALT`; unset = no salt) |

Output is JSON on stdout. Exit codes: `0` ok · `1` a finding (invalid evidence, refused decisions, a decision skipped
for a reason other than "already applied", a refused profile write) · `2` usage.

## Inputs

**Vocabulary** (`presets/travel.vocab.json` is the worked example):

```json
{"v":1, "name":"travel", "title":"Travel preferences", "max_tokens":2000,
 "dimensions":[{"id":"pace", "label":"Pace", "cardinality":"one", "values":["relaxed","normal","packed"]},
               {"id":"food", "label":"Food", "cardinality":"many", "hint":"cuisines, dishes, ways of eating"},
               {"id":"mobility", "label":"Mobility", "cardinality":"many", "polarity_labels":{"+":"ok with","-":"avoid"}}]}
```

`cardinality:"one"` dimensions hold a single value from a closed `values` list (confirming a rival replaces it);
`"many"` dimensions hold any number of free values (≤ 60 characters), each liked (`+`) or avoided (`-`).
`max_tokens` (200..20000, default 2000) caps the rendered profile.

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
| profile | `max_tokens`, default 2000 |

## What it never does

Read Gmail, Calendar, Drive or any other source; call the network; send or draft messages; write outside the paths it
is given; clear an `injection_suspect` flag; treat excerpt text as instructions; overwrite a profile edited by hand.

## Dependencies

None: Node 22 built-ins only (`node:fs`, `node:path`, `node:crypto`, `node:url`).

## Library

`import * as prefs from './index.mjs'` exposes `check`, `ingest`, `review`, `apply` (same options as the CLI, as an
object) and the building blocks (`loadVocab`, `validateVocab`, `normalizeEvidence`, `buildCandidates`, `buildReview`,
`readDecisions`, `applyDecisions`, `renderProfile`, …). Fixtures: `fixtures/evidence-sample.json` (invented trip
evidence with one planted injection) and `fixtures/decisions-sample.json`.

Developed by: LightAISolutions
