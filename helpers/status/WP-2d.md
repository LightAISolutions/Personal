# WP-2d — Prefs kit: status

**State: done** (branch `wp-2d`, not pushed). Decisions and assumptions: `helpers/decisions/WP-2d.md`.

## Contract (SPEC §16 row WP-2d, coordinator brief)

| Item | State |
|---|---|
| Evidence records (source kind, opaque source ref, date, capped + sanitised excerpt, suggests dimension/value/polarity, `injection_suspect`) | done — `lib/evidence.mjs` |
| Generic: vocabulary supplied by the caller; travel vocabulary ships as the `travel` preset | done — `lib/vocab.mjs`, `presets/travel.vocab.json` |
| Grouping into candidates with support counts and conflicts, written as quarantine notes in a caller-named directory | done — `lib/candidates.mjs`, `lib/held-notes.mjs` |
| Confirm step: proposal text + payload, ✅ / ✏️ / ❌ per candidate within SPEC §18 limits | done — `lib/review.mjs` (`pf:<cid>:y\|e\|n`, ≤ 64 bytes) |
| `apply`: promote only confirmed or edited candidates, with provenance (date, evidence ids) | done — `lib/confirmed-prefs.mjs` |
| Rejections remembered, never re-proposed | done (ledger beside the profile) |
| Profile size cap ≤ 2k tokens, enforced | done (`max_tokens`, refuses before writing) |
| Invariant tests: no profile without an owner decision record · suspect never auto-promoted and labelled · instructions in an excerpt are data · idempotent re-runs · edits keep provenance | done — `helpers/tests/kit_prefs_flow.test.js`, `kit_prefs_evidence.test.js` |
| Fixture evidence only; no connector reads | done — invented Port Ambry data on reserved domains, one planted injection |

Tests: 27 new (`kit_prefs_evidence` 8, `kit_prefs_flow` 16, `kit_prefs_cli` 3); whole suite 81/81.

## How to run

```
node --test helpers/tests/kit_prefs_*.test.js
node helpers/kits/prefs/index.mjs ingest --vocab travel --held <tmp>/held --profile <tmp>/travel-prefs.md helpers/kits/prefs/fixtures/evidence-sample.json
node helpers/kits/prefs/index.mjs review --vocab travel --held <tmp>/held --profile <tmp>/travel-prefs.md
node helpers/kits/prefs/index.mjs apply  --vocab travel --held <tmp>/held --profile <tmp>/travel-prefs.md helpers/kits/prefs/fixtures/decisions-sample.json
```

## Requests for the coordinator (outside WP-2d's paths)

1. **SPEC §16 kit layout** — `node helpers/kits/<kit>/ <command>` does not run `index.mjs` (Node resolves a directory only
   through `index.js` or `package.json#main`). Coordinator already fixing (note received); the prefs README and tests use
   `node helpers/kits/prefs/index.mjs <command>`. Proposed wording: `index.mjs  CLI entry — node helpers/kits/<kit>/index.mjs <command> …`.
2. **Phase 5 core (Telegram)** — to close the loop the core must: register callback prefix `pf` (`cbEncode('pf', cid, y|e|n)`
   is what the kit already emits as `pf:<cid>:<code>`); on ✏️ ask for the replacement value and take the owner's next
   reply as `value`; HTML-escape each item `text` before sending (the kit emits plain text); collect taps into a
   `request` envelope with `payload: {kind:"prefs_decisions", decisions:[{cid, decision, value?, decided_at}]}`
   (or a `{v:1, kind:"prefs_decisions", source:"owner", via:"telegram", decisions}` document) for the routine to pass to
   `apply`. The review payload (`kind:"prefs_review"`) needs a pack envelope type, e.g. `prefs_review` in the Tour
   Guide pack's `types`.
3. **Private-repo paths (Phase 4)** — the routine should run `ingest --held quarantine/prefs/` and keep the profile at
   e.g. `profile/travel-prefs.md` (ledger beside it). The kit takes these as arguments; nothing in `helpers/` names them.
4. **Salt** — set `PREFS_REF_SALT` in the routine environment (any private string) so source-ref hashes in the private
   repo cannot be checked against guessed message ids. Optional; without it hashes are unsalted but still opaque.

Developed by: LightAISolutions
