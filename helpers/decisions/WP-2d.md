# WP-2d — Prefs kit: decisions and assumptions

Choices made without asking (common rules: never ask, record the default taken). Numbered so later phases can cite them.

| # | Choice | Default taken | Why |
|---|---|---|---|
| 1 | Where decisions live | A **ledger** JSON beside the profile (`<profile>.decisions.json`); held notes carry evidence only | The profile renders from the ledger alone, so deleting or pruning `quarantine/` loses nothing the owner decided, and rejections survive to block re-proposal |
| 2 | Held-note format | Markdown for the owner + a kit-managed JSON block (`## Data`) for the kit | Notes are read by people in the private repo; the JSON block keeps parsing exact |
| 3 | Note naming | `prefs-<dimension>-<value>-<cid6>.md` in the caller's directory | Boundary rule: no `profile*` names or memory directory names inside `helpers/`; the prefix keeps notes recognisable in a shared `quarantine/` |
| 4 | Ids | Content hashes: evidence `e_` + 12 hex of (kind, hashed ref, dimension, value, polarity); candidate `c_` + 10 hex of (dimension, value); batch `pfb_` + 16 hex | No clock, no randomness: re-runs are byte-identical, and a cid fits 64-byte callback data |
| 5 | Source refs | The kit hashes the raw ref at ingest (24 hex, optional salt from `PREFS_REF_SALT`) | The reader agent may have no shell to hash; the raw id never reaches disk |
| 6 | Excerpt sanitising | Strip tags, control and zero-width characters; mask e-mails, digit runs of 6+, and separated numbers of 9+ digits; one line, 280 characters | Booking refs, card, account and phone numbers never reach memory; dates and times survive |
| 7 | Injection heuristics | Nine conservative patterns on the raw text and a folded copy (zero-width and diacritics removed); hit ⇒ `injection_suspect` with pattern ids; a reader's `true` is kept; never cleared | Tuned against false positives on ordinary booking mail ("travel agent:", "send a confirmation email") |
| 8 | Suspect evidence | Never counted as support; suspect-only candidates held back; shown only with `--include-suspect`, labelled, excerpt withheld | "Never auto-promoted and labelled"; withholding the text keeps instructions out of the owner's chat |
| 9 | When a candidate is proposed | Clean support ≥ `--min-support` (default 1), a clear stance (pro ≠ con), not already decided; a single-value dimension seen only negatively is held back | Default 1 because the owner confirms every item anyway; ties and negatives have nothing to state |
| 10 | Single- vs multi-value dimensions | `cardinality:"one"` (closed values; latest confirmed value replaces the rival, the review says "Profile now: …") or `"many"` (free values, liked / avoided) | Pace or budget is one thing at a time; interests are a list |
| 11 | Effective decision | The latest by `decided_at`; older or repeated ones go to history; a decision already recorded is "already applied" | Taps can arrive out of order; re-running must be a no-op |
| 12 | Decision provenance | A document must say `source:"owner"`, or be a core `request` envelope; any bad item refuses the whole document; ≤ 50 items | The kit cannot prove authorship; it enforces the declared provenance and an exact shape (documented in the README) |
| 13 | Edit values | Must pass the vocabulary (closed list for single-value dimensions, ≤ 60 characters); a refused edit is skipped with a reason | An owner typo must not put an unknown value in the profile |
| 14 | Token estimate for the cap | characters / 3.5, rounded up; cap from the vocabulary (`max_tokens`, default 2000) | Conservative and dependency-free; over cap ⇒ nothing written |
| 15 | Hand-edited profile | A body-hash trailer; a mismatch, a missing trailer or another vocabulary refuses the write | The kit owns the file; owner changes go through decisions so provenance holds |
| 16 | Writes | Ledger first, then profile, each via temp file + rename; notes only when changed | A crash leaves the old profile, and re-running `apply` converges |
| 17 | Evidence per note | Newest 50 per candidate (counted and written the same) | Bounds note size; support counts stay honest |
| 18 | Review size | ≤ 20 items (default 8), item text ≤ 1200 characters plain text, payload ≤ 65 536 | One Telegram message per item, well under 3900; the core HTML-escapes |
| 19 | CLI path | `node helpers/kits/prefs/index.mjs <cmd>`; no per-kit `package.json` | Node does not run a directory's `index.mjs`; a `package.json` per kit would collide on basename (PC-UNIQUE-FILES) |
| 20 | Vocabulary location | Presets in `presets/<name>.vocab.json`; any file path also accepted | Generic kit, travel as the documented example; the knowledge-wiki helper brings its own file |
| 21 | Evidence input formats | JSON array, `{"evidence":[…]}` or JSON Lines | Readers append JSONL naturally; arrays are easier by hand |
| 22 | Exit codes | 0 ok · 1 finding (including a skip other than "already applied") · 2 usage | Routines can fail loudly without parsing JSON |

Developed by: LightAISolutions
