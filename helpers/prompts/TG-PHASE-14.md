# Phase 14 — Branches before the trip: the scaffold, Scout's ranking, the veg card, the owner's lists, compare, one Discover routine

> Written 2026-10-04 by the coordinator of the owner's morning review. The owner approved decision-page items 7, 10, 11, 12, 15 and 16 (with notes on 11, 12 and 22) and asked for them after the fix package (Phase 13). Model rule (owner): coordinator Opus 5.5, builders `hb-builder-opus` (Opus 5.5 · high; WP-14b at medium), **no Fable anywhere**. Start with `Read helpers/prompts/TG-PHASE-14.md and execute it exactly.` Progress in `helpers/BUILD-STATE.md`.

The review called Scout the first **branch**: a request kind, a skill with two small drivers around one judgment step, a pure engine with tests, a validated envelope that carries only our own words and scores, a tab in the core, a chat message and an app screen, and a write to memory the planner already reads. This phase builds the scaffold that makes the next branch cheap, tunes Scout's ranking, and adds three branches the owner wants before the trip.

**The owner's notes, generalised.**
- **Item 11.** The owner does not want to forward map links to the bot. They want Tour Guide to read the place lists they already keep in Google Maps and keep its Places in step with them. The route is settled (the owner chose it on a card): Google Takeout's **Saved** export, scheduled to the owner's Drive every two months, plus a manual export whenever the owner wants a fresh copy. It is **read-only**: Tour Guide never writes to Google's lists. (Google's Data Portability API, which reads lists directly, is not offered in the owner's region.)
- **Item 12.** Compare also takes a list ("compare my dinner list"), not only named places.
- **Item 22** (not now). A downloadable PDF of the brochure is enough for sharing. The chat already sends it as a document; the app gets a PDF button.

**Waves.** Wave 1 is three framework work packages in parallel, each in its own worktree from `origin/main` (v01.65r or later): WP-14a the scaffold, WP-14b Scout's ranking, WP-14c the veg card. Wave 2 (the lists, compare, the Discover routing) starts after wave 1 is merged and pushed, and builds on WP-14a's scaffold and WP-14b's tuned engine; its briefs are in the Wave 2 section. The private repo follows each push in one pull request per wave for the owner.

## Done when (the owner's criteria, generalised for this public repo)

| Item | Done when |
|---|---|
| 15 Branch scaffold | `node helpers/tools/new-branch.mjs <name>` writes a branch skeleton: the core module (command, kind request, envelope validator and handler, tab), the app op stub, the envelope schema with the pack validator and a parity test, the kind routing, the `helper.json` entry, and the private skill skeleton. The skeleton passes `bundle.mjs --all --check`, the whole test suite and the boundary check untouched. `new-branch.mjs --check <name>` passes for Scout and for the veg card, and names the missing piece when one is removed. |
| 7 Scout's ranking | The review's seven recommendations, each with a test: a 4.5 means the same on every board; a chain or a crowd magnet no longer outranks a local favourite on the strength of its rating; a new place the judgment vouches for is kept and labelled "new"; drinks, cafés and markets are "likely" for a vegetarian party while meals stay strict; an unjudged place gets a low fit and says "not judged"; the card shows all five parts of the score; one estimator gives the minutes for a leg. |
| 10 Veg card | `/vegcard` returns the party's card in the destination's language and English; the morning message links it; the app shows it full screen; the private brochure prints it as its last page. Building it needs no judgment step, and showing it needs no routine. |
| 22's note | The app's brochure screen has a PDF button that sends the stored PDF to the chat as a document, or starts a brochure build when there is none. |
| 11 The owner's lists (wave 2) | A Takeout Saved export in the owner's Drive becomes Places tagged with their list names and the owner's notes. `/lists` shows the lists with counts; `/list <name>` shows a list's places; `/lists sync` reads the newest export now. A place that left a list loses the tag and is never deleted; a list item Tour Guide cannot match to a place is named in the reply, never guessed. |
| 12 Compare (wave 2) | `/compare <a>, <b>[, <c>, <d>]` or `/compare <list>` returns a Scout-style board of exactly those places (reach from where you stay, open on your days, vegetarian status, booking rule, what to try, price band) in the chat and the app within one routine run. Nothing the owner named is dropped: a place that fails a screen is shown with the reason. |
| 16 One Discover routine (wave 2 and the owner) | Scout, compare, lists and veg-card requests go to one `DISCOVER` routine when it is configured, and where they go today when it is not. The private repo's `discover` skill picks the skill by request kind. The owner creates the routine and pastes its fire URL and token (guide §4). |

## Contract C14 — new fields and one new envelope

Every new field is optional and every new type is additive, so old trips, places, digests, requests, the private repo's current pin and the live core keep working. A validator accepts a field only with the type and bounds below and still refuses unknown keys. Wave 1's part is here; wave 2's part is in the Wave 2 section.

**Wave 1**

| Where | Field | Type | Meaning |
|---|---|---|---|
| `helper.json` `envelope_types` | `veg_card` | new type | The party's veg card for one trip (below) |
| new request kind | `vegcard` | payload `{ trip: slug, rebuild?: true }` | Build (or rebuild) the current trip's card. Routed to `RESEARCH` until wave 2's Discover routing |
| `scout` item `parts` | `local` | integer 0–100, like the other four parts | The local word-of-mouth part the score already uses, so the card can show all five parts (WP-14b) |
| `scout` item `labels` | `not_judged` | new enum value | The judgment step gave no fit for this place (WP-14b). `new` already exists; WP-14b gives it its meaning |

**The `veg_card` payload** (WP-14c owns the schema, both validators and the parity test):

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | |
| `trip` | slug | The trip the card was built for |
| `country` | `^[A-Z]{2}$` or `null` | The destination's country, from the trip |
| `lang` | `"ja"` or `null` | The card's local language; `null` means English only (no phrase table for that country yet) |
| `diet` | `"vegetarian"`, `"vegan"` or `null` | The party's diet: the strictest member's (`partyDiet`) |
| `party` | integer 1–12 | How many travellers the card speaks for ("I" or "we") |
| `fp` | `^vcf1:[0-9a-f]{8}$` | The card's fingerprint (below) |
| `sections` | array 1–6 of `{ id, lines }` | `id` is one of `intro`, `avoid`, `ok`, `ask`, `thanks`, each at most once, in that order. `lines` is an array 1–12 of `{ local, en }`: `local` is a string 1–200, or `null` exactly when `lang` is `null`; `en` is a string 1–200 |
| `english_only` | array ≤ 12 of strings 1–60 | Cannot-eat values from a profile that have no phrase yet. The card shows them in English with "show this in a translation app" |

Every line comes from the pack's phrase table; the only owner words on the card are the `english_only` values (a profile's own cannot-eat words), and nothing comes from Google. The whole payload stays under 8,000 characters.

**The card's fingerprint.** `vcf1:` and the lower-case 8-hex FNV-1a (32-bit, the same function as C13's `lodging_fp`) of the UTF-8 string `v1|<lang or ->|<diet or ->|<one or many>|<the extra avoid keys, sorted, joined by ,>|<english_only lower-cased, sorted, joined by ,>`. Only the engine computes it. The core stores it, and the routine sends the card with `dedupe_key` `vegcard:<trip>:<fp>`, so an unchanged card is dropped as a duplicate.

**Wave 2** has its own table in the Wave 2 section: a `lists` request kind, `lists`, `list_notes` and `cid` on a place file, `lists` on a `places_digest` place, a `compare` request kind, and `mode`, `source`, item `flags` and the `not_found` reason on a `scout` payload, so compare reuses Scout's envelope, store, chat card and app screen.

## Step 0 — Orient (every WP)

1. Read `CLAUDE.md`, `helpers/SPEC.md` (§5 registries, §16 ownership map, §18 limits), `helpers/packs/tour-guide/README.md`, `helpers/decisions/TG-SCOUT.md`, `TG-PHASE-13.md`, `WP-13c.md` and `WP-13d.md`, Contract C14 above, and every file your section names. Name functions when you cite code; line numbers move.
2. In your worktree run `node --test helpers/tests/`, `node helpers/tools/bundle.mjs --all --check` and `node helpers/tools/boundary-check.mjs`. All three must be clean before you start; if not, stop and write why in your status file.
3. Study Scout end to end before you change or copy it: `gas/16_scout.js` (command, kind request, validator, handler, store), `gas/35_scout_app.js` (app ops), `helpers/packs/tour-guide/scout/` (engine, payload, board), `schemas/tour-guide-scout.schema.json`, the Scout tests in `helpers/tests/`, and the Scout screen in `live-site-pages/helper-app.html`. The private repo's two drivers are described in `TG-SCOUT.md`; you cannot see them, and you never need to.
4. Write a failing test for each behaviour you add or change before you change the code, and keep the test.

## WP-14a — The branch scaffold (item 15) · `hb-builder-opus`

**Goal.** "Scout cost a phase; the next branch should cost an afternoon." One script writes every piece a branch needs, wired the way Scout is wired, so a builder fills in behaviour instead of rediscovering plumbing. A second mode checks that an existing branch is complete.

**Owns:** `helpers/tools/new-branch.mjs`, `helpers/tools/branch-templates/**`, `helpers/tests/tools_new_branch.test.js`, `helpers/decisions/WP-14a.md`, `helpers/status/WP-14a.md`, and a new "Branches" section in `helpers/tools/README.md` (create the file if it does not exist). It edits no existing pack or core module: if additive registration needs a change to a shared file, that is a REQUEST.

**The command.**

```
node helpers/tools/new-branch.mjs <name> [--pack tour-guide] [--title "<Title>"] [--command /<cmd>] [--kind <kind>]
     [--envelope <type>] [--routine RESEARCH] [--tab <Tab>] [--no-app] [--no-envelope] [--no-tab] [--prefix NN]
     [--private-out <dir>] [--dry-run] [--force]
node helpers/tools/new-branch.mjs --check <name> [--pack tour-guide]
```

`<name>` is lower-case `[a-z][a-z0-9]{1,23}`. The defaults derive from it: command `/<name>`, kind `<name>`, envelope type `<name>`, tab `<Name>s`, routine `RESEARCH`. It refuses a name, command, kind, envelope type or tab that already exists (exit 2, naming the clash), and never overwrites a file without `--force`. `--dry-run` prints every file it would write or change, and writes nothing.

**What it writes** (for the tour-guide pack; the paths follow Scout's layout):

1. **The core module** `helpers/packs/<pack>/gas/<NN>_<name>.js`, with the next free number in the 1x–2x band unless `--prefix` is given:
   - `registerCommand('/<cmd>', …)`. It finds the current trip the way Scout's command does, opens the request with `tgOpenKindRequest('<kind>', payload, …)`, and acknowledges in plain words.
   - The kind's routing, added from this file at load time (`TG_KIND_ROUTINE['<kind>'] = '<ROUTINE>'`). Never edit `00_common.js`. Verify that `tgKindRoutine` reads the table at call time, so a key added by a later file is seen; if it does not, that is a REQUEST.
   - The tab, unless `--no-tab` (a branch that keeps its data in an existing tab): `registerSheet('<Tab>', [...])`, with a key column, `received_at` and a JSON column. Add the name to `TG_SHEETS` from this file if Scout's code reads tab names from there.
   - The envelope validator `tgEnvValidate<Name>(p)`, built on the shared helpers (`tgEnvHead`, `tgEnvObj`, `tgEnvStr`, `tgEnvSize`, `tgEnvDone`). It refuses unknown keys.
   - The handler, registered only while `helper.json` lists the type (Scout's guard: `if (ENVELOPE_TYPES.indexOf('<type>') >= 0) registerEnvelopeHandler(...)`). It stores the payload in the tab and sends the owner a short line.
   - A help line, and `// Developed by: LightAISolutions` as the last line.
2. **The app ops** `helpers/packs/<pack>/gas/<NN>_<name>_app.js`, in the 3x band, unless `--no-app`: `<name>.get { id }` and `<name>.list {}`, registered into `TG_APP_OPS` from this file (as `35_scout_app.js` does), each answering only the branch's own stored fields.
3. **The envelope schema** `helpers/packs/<pack>/schemas/<pack>-<name>.schema.json`, in the same draft and style as the other pack schemas. It has `v`, `trip` and one placeholder field, with `additionalProperties: false`.
4. **The pack side** `helpers/packs/<pack>/<name>/`:
   - `<name>-payload.mjs`, with `validate<Name>Payload(p) → string[]` mirroring the core validator, and `build<Name>Payload(...)`;
   - `index.mjs`;
   - `README.md`;
   - an invented fixture.
5. **The tests** `helpers/tests/pack_<pack>_<name>.test.js`:
   - a parity test: the core validator, loaded the way the existing parity tests load GAS files, and the pack validator agree on every valid and invalid fixture;
   - the command, kind routing and handler are registered;
   - the schema accepts the valid fixture.
6. **`helper.json`**: the type is appended to `envelope_types`, idempotently, preserving the file's formatting. Skipped with `--no-envelope`.
7. **The private skill skeleton**, only with `--private-out <dir>` (the private repo's `skills/` folder, reached through its vendored copy: `node vendor/helpers/tools/new-branch.mjs … --private-out skills`):
   - `<dir>/<name>/SKILL.md`, with the sections the private repo's `skills/README.md` requires: purpose, inputs, envelope types with an example, memory it may touch, and the silence rule;
   - `<name>-start.mjs` and `<name>-finish.mjs`, two drivers around one judgment step, importing from `vendor/helpers/…`.

   The templates carry no personal data and no real place, and they pass the boundary check.

**The check.** `--check <name>` lists, for an existing branch:
- the command;
- the kind and its routing;
- the envelope type in `helper.json`, its handler, schema, pack validator and parity test;
- the tab;
- the app ops.

It prints what is missing and exits 1 if anything is. It reads the code, not a registry file, so it works for Scout, which was built by hand. It must pass for `scout` now, and for `vegcard` once WP-14c is merged (the coordinator runs it). When a branch legitimately lacks a piece (`--no-app`, `--no-envelope`, `--no-tab`, alone or together), it says "not needed" rather than failing; record how the check learns that.

**Tests** (`tools_new_branch.test.js`):
- Generate a demo branch into a temporary copy of `helpers/` and `live-site-pages/`. On that copy, its parity test passes, `bundle.mjs --all --check` passes, the boundary check passes and `--check demo` passes.
- Remove one piece from the copy, and `--check demo` fails naming that piece.
- Every clash is refused: an existing name, command, kind, envelope type or tab.
- `--dry-run` writes nothing.
- `--check scout` passes on the real tree.
- The generated core module loads in the GAS test harness without throwing.

**Docs.** In `helpers/tools/README.md`, a "Branches" section: the shape of a branch (the parts listed at the top of this file), the command, the check, and what the builder still writes by hand (the behaviour, the judgment step, the real fields).

## WP-14b — Scout's ranking, tuned (item 7) · `hb-builder-opus-medium`

**Goal.** The review read Scout's ranking and found seven places where it ranks differently from how the owner would: novelty and local specialties first, the vegetarian rule strict for meals and sensible for drinks, and a score that means the same on every board.

**Owns:** `helpers/packs/tour-guide/scout/**`, `schemas/tour-guide-scout.schema.json`, `helpers/decisions/TG-SCOUT.md` (the weights and parts sections), the Scout tests, `helpers/decisions/WP-14b.md` and `helpers/status/WP-14b.md`. Also two narrow edits outside the pack's engine:
- In `gas/16_scout.js`: the label list, its words, `parts.local` in the validator, and the chat card's label line only.
- The Scout screen's bars in `live-site-pages/helper-app.html`, without the page's version file or changelog (the coordinator does those).

**The seven changes** (each with a failing test first; record every default in the decisions file):

1. **A fixed quality anchor.** Quality is a Bayesian rating pulled toward μ, and `rankScout` today sets μ to the mean rating of whatever the search returned. So a 4.5 is "average" in a pool that averages 4.5 and "excellent" in one that averages 4.1, and a few low-rated results lift everyone else.
   - Use a fixed μ per group in `scout-weights.mjs` (default food 4.2, activities 4.3), with the existing default for any other group.
   - Test: the same record gets the same quality part in two pools with different means.
2. **A chain or a crowd magnet pays for it.** Today a chain scores zero only on the 10% local part and keeps everything else, so a 4.6-star chain with thousands of ratings can outrank a local favourite.
   - Subtract a fixed chain penalty from the score (default 8 points of 100).
   - Subtract a crowd penalty (default 4) when the rating count passes the crowd threshold. Find the planner's crowd-magnet threshold (Phase 11) and reuse it; if there is none, use 5,000 and say so.
   - Test: a chain at 4.6 with 3,000 ratings ranks below a 4.4 local favourite with the same topic and reach. A crowd magnet loses its penalty points and keeps its place in the list.
3. **A judgment can rescue a new place.** Fewer than the minimum ratings and no local mention is screened as `unproven` before the judgment is read, so the branch whose job is finding new options drops them.
   - Skip the `unproven` screen when the judgment gives relevance ≥ 0.7 or `veg: "verified"`.
   - Label a rescued place `new` (the label exists; this gives it its meaning).
   - Test: both rescue paths keep the place with `new`; an unrescued new place is still left out as `unproven`.
4. **Drinks, cafés and markets are "likely"; meals stay strict.** With a vegetarian party, every food pick without a judgment is dropped as "vegetarian not confirmed", including tea houses, bars, coffee and markets, which are plant-based by nature or full of choice.
   - In `scout-text.mjs`, split the words into three lists:
     - **drinks** (bar, sake, wine, beer, cocktail, coffee, tea, tea house, matcha, kissaten, juice);
     - **cafés and sweets** (café, sweets, dessert, wagashi, bakery, ice cream, parfait), together with **markets** (market, food hall);
     - **meals** (ramen, udon, soba, kaiseki, izakaya, lunch, dinner, sushi, tempura, okonomiyaki, curry, teishoku, restaurant).
   - Without a judgment: drinks are "likely" for a vegetarian or vegan party; cafés, sweets and markets are "likely" for a vegetarian party only (the vegan rule already drops desserts and bakeries); meals keep today's strict screen, including Phase 13's hidden-stock rule.
   - A judgment's `veg` always wins over the word lists. "Likely" is the existing `veg_likely` label and never reads as verified.
   - Tests:
     - A tea house and a bar pass with `veg_likely` and no judgment.
     - A ramen shop without a judgment is still left out.
     - A market passes for a vegetarian party and not for a vegan one.
     - A judgment of `veg: "none"` drops a bar.
5. **An unjudged place gets a low fit.** When the judgment has no fit, the part defaults to 0.5, so a place nobody looked at can outscore a judged place with fit 0.3.
   - Default to 0.3, and add the label `not_judged` (C14), shown as "not judged" on the card and in the chat.
   - Test: a judged place with fit 0.35 outranks an otherwise equal unjudged one.
6. **The card shows the whole score.** The card shows four bars, but the score has five parts.
   - Send `parts.local` (C14), and show five bars (topic, quality, fit, local, reach) on the board card and the app's Scout card.
   - An old payload without `local` still shows its four.
   - Test: the five bars, weighted, reproduce the score within rounding.
7. **One estimator.** The private driver estimates an unmeasured leg with the planner's rail figures, while the engine's own fallback (`reachFor`) uses a straight-line transit speed. A measured place and an estimated one can show different minutes for the same distance.
   - Make the fallback use the planner's estimate: `railEstimate` in `planner/planner-rail.mjs` above the walking limit, and the planner's walking minutes below it.
   - Export the estimator from `scout/index.mjs`, so the private driver can drop its copy (a REQUEST for the private side).
   - Test: the same two points give the same minutes through `reachFor` and through the export.

**Compatibility.** Old Scout payloads (no `local`, no `not_judged`) still validate in both validators and display. Boards stored before this phase keep their scores.

## WP-14c — The veg card, and the brochure PDF in the app (item 10, item 22's note) · `hb-builder-opus`

**Goal.** The party's hard dietary limit is the one Google cannot check, and the moment it fails is at the counter, in the local language, possibly with no signal. One card, in the destination's language and English, says what the party does not eat, with the polite phrasing a server expects and the three questions asked most. It is built from the party's diet once per trip, and shown from storage after that: `/vegcard`, a link in the morning message, a full-screen app view, and the brochure's last page (the private side prints it).

**Owns:**
- the engine: `helpers/packs/tour-guide/vegcard/**` and `schemas/tour-guide-veg-card.schema.json`;
- the type: `veg_card` in `helper.json` `envelope_types`;
- the core: `gas/27_vegcard.js` and `gas/37_vegcard_app.js`;
- the veg-card tests, `helpers/decisions/WP-14c.md` and `helpers/status/WP-14c.md`.

Narrow edits elsewhere:
- one line in `gas/18_morning.js` (the link);
- in `gas/32_app_api.js`: `has_vegcard` on the trip row, and the `brochure.pdf` op beside `brochure.get`;
- in `live-site-pages/helper-app.html`: the Veg card screen and the brochure PDF button, without the page's version file or changelog.

**The engine** (`vegcard/`):
- `vegcard-phrases.json`: the phrase table (below).
- `vegcard.mjs`:
  - `vegCard({ party, country })` → the C14 payload body. `party` is `partyDiet`'s result plus `size`.
  - `vegCardFp(...)`.
  - `LANG_BY_COUNTRY` (`JP` → `ja`; any other country → `null` for now).
- `vegcard-render.mjs`:
  - `vegCardTelegram(card)`: chat HTML. Each line's local text in bold, its English in italics beneath; a header "🥗 Veg card — show this to the staff".
  - `vegCardHtml(card)`: a self-contained, printable section with large local text, English beneath, high contrast, fitting one phone screen. Follow the brochure kit's page conventions (find the kit under `helpers/kits/`) so the private brochure can append it as its last page.
- `vegcard-payload.mjs`: `validateVegCardPayload(p) → string[]`, mirroring the core validator.
- `index.mjs`, `README.md`, and an invented fixture party.

**How a card is composed.**

The diet:
- comes from `partyDiet` (the strictest member);
- `size` 1 is "I", and more is "we".

The sections, in order, each built from the table:
1. `intro`: the diet's opening line, or, for a party with limits but no diet, "I/We cannot eat the following".
2. `avoid`:
   - For a vegetarian or vegan party: the fish-stock line, the bonito-flakes line, the sauces-and-broth line, then one "also" line listing the extra limits the diet does not already cover.
   - For a party with no diet: one line per limit.
3. `ok`: what is fine. Vegetables, tofu, rice and noodles, plus eggs and dairy for a vegetarian party unless a member avoids them. Then the kelp-or-shiitake-stock line, for any vegetarian or vegan party.
4. `ask`: three questions, the diet's form of each.
5. `thanks`: one polite closing line.

The limits:
- Map each `dietary` value through the table's aliases.
- Never repeat a limit the diet already covers: seafood covers shellfish; vegan covers eggs and dairy.
- A value with no alias goes to `english_only`.
- Lines are composed by joining items with 「・」 in Japanese and with commas in English.

**The phrase table to start from.** Keep the polite です/ます form, and keep the explicit list of what is not eaten: in Japan the word "vegetarian" alone is often taken to allow fish stock. Check every line for natural, polite Japanese, and record any change you make in the decisions file.

```
intro.vegetarian.one   私はベジタリアンです。肉・魚・魚介類は食べられません。 | I am vegetarian. I do not eat meat, fish or seafood.
intro.vegetarian.many  私たちはベジタリアンです。肉・魚・魚介類は食べられません。 | We are vegetarian. We do not eat meat, fish or seafood.
intro.vegan.one        私はヴィーガン（完全菜食）です。肉・魚・魚介類・卵・乳製品は食べられません。 | I am vegan. I do not eat meat, fish, seafood, eggs or dairy.
intro.vegan.many       私たちはヴィーガン（完全菜食）です。肉・魚・魚介類・卵・乳製品は食べられません。 | We are vegan. We do not eat meat, fish, seafood, eggs or dairy.
intro.limits.one       私は次のものが食べられません。 | I cannot eat the following.
intro.limits.many      私たちは次のものが食べられません。 | We cannot eat the following.
avoid.stock            かつおだしや煮干しなど、魚のだしも食べられません。 | That includes fish stock (dashi made from bonito or dried sardines).
avoid.flakes           かつお節も使わないでください。 | Please no bonito flakes (katsuobushi) either.
avoid.sauces           魚醤、オイスターソース、肉のスープ（ガラスープ・ブイヨン）、ラード、ゼラチンもだめです。 | No fish sauce, oyster sauce, meat broth, lard or gelatin.
avoid.also             {items}も食べられません。 | I/We also cannot eat {items}.
ok.base                {items}は大丈夫です。 | {items} are fine.
ok.stock               昆布や椎茸のだしなら大丈夫です。 | Kelp (kombu) or shiitake stock is fine.
ask.dashi              この料理に、だしや魚は入っていますか？ | Does this dish contain dashi or fish?
ask.without            魚のだしを使わずに作っていただけますか？ | Could you make it without fish stock?
ask.which.vegetarian   肉も魚も使っていない料理はありますか？ | Which dishes have no meat and no fish?
ask.which.vegan        肉・魚・卵・乳製品を使っていない料理はありますか？ | Which dishes have no meat, fish, eggs or dairy?
ask.contains           この料理に{items}は入っていますか？ | Does this dish contain {items}?
thanks                 お手数をおかけしますが、よろしくお願いします。 | Sorry for the trouble, and thank you.

items (aliases → ja | en)
meat (meat) 肉 | meat · pork (pork) 豚肉 | pork · beef (beef) 牛肉 | beef · poultry (poultry, chicken) 鶏肉 | chicken
fish (fish) 魚 | fish · seafood (seafood) 魚介類 | seafood · shellfish (shellfish) エビ・カニ・貝類 | shellfish (shrimp, crab, clams)
eggs (eggs) 卵 | eggs · dairy (dairy) 乳製品（牛乳・バター・チーズ） | dairy (milk, butter, cheese) · nuts (nuts) ナッツ類 | nuts
gluten (gluten, wheat) 小麦（グルテン） | wheat (gluten) · alcohol (alcohol) アルコール（料理酒・みりんを含む） | alcohol, including cooking sake and mirin
ok items: 野菜 | vegetables · 豆腐 | tofu · ご飯 | rice · 麺 | noodles · 卵 | eggs · 乳製品 | dairy
diet values: "meat and fish", "vegetarian" → vegetarian · "animal products", "vegan" → vegan (plus dietFromValues' own rules)
```

For a party with no diet, the three questions are `ask.contains` (with at most three items), `ask.without` only when fish or seafood is a limit, and no `which` line.

**The core** (`27_vegcard.js`, `37_vegcard_app.js`):

- **`/vegcard`**:
  - When the current trip has a stored card, it is rendered from the stored payload (escape everything; the core has its own small renderer).
  - Otherwise, a `vegcard` request opens with "🥗 Making the veg card for <trip>…".
  - `/vegcard rebuild` always opens a request with `rebuild: true`.
  - The kind routes to `RESEARCH`, added from this file.
- **The handler**:
  - It validates and stores the card in a `VegCards` tab, keyed by trip, with its `fp`.
  - It sends the card to the owner when the envelope answers an open request (`in_reply_to`) or when the `fp` differs from the stored one. Otherwise it stores silently.
  - A card for an unknown trip is refused and audited.
- **The morning message**: one line near its end when the day's trip has a card: "🥗 Veg card — /vegcard", plus the app link where the message already shows app rows.
- **The app**:
  - `vegcard.get { slug }` answers the stored card, or 404 `no_vegcard`.
  - `has_vegcard` on the trip row opens a full-screen "Veg card" view from the trip's home row, with large local text, English beneath each line, and a button to hide the English.
- **The brochure PDF** (item 22's note): `brochure.pdf { slug }`.
  - When the trip's stored PDF is inside the helper's Drive folder (the `/brochure` rule), send it to the owner's chat as a document, reusing the `/brochure` path, and answer `{ sent: true }`.
  - When there is no PDF, open a brochure request as `/brochure` does, and answer `{ building: true }`.
  - Refuse an id outside the folder, and audit it.
  - At most one send per trip per minute.
  - The app's brochure screen gets a "PDF" button with "Sent to the chat" or "Building — it arrives in the chat".

**Tests:**
- The phrase table:
  - every cannot-eat example in `kits/prefs/presets/travel.vocab.json` and every diet option in `travel.interview.json` maps to a diet or an item;
  - anything else lands in `english_only`.
- Composition:
  - a vegetarian party of two with nuts;
  - a vegan party (no eggs or dairy among the fine items; the vegan question);
  - a shellfish-only party (no diet);
  - a destination with no table (English only, `local` null everywhere).
- The fingerprint ignores order and case, and changes when a value is added.
- Escaping and bounds.
- Parity between the core and pack validators.
- The command with and without a card; the handler's send-or-silent rule.
- The morning line with and without a card.
- The app op; the PDF op's three cases and its rate limit.
- The old pin's envelopes still validate.

## Wave 2 — the owner's lists, compare, the Discover routing (items 11, 12, 16)

Written by the coordinator while wave 1 was being built; spawned after wave 1 is merged and pushed (v01.66r). Two framework work packages in parallel, each in its own worktree from `origin/main`: WP-14d the lists, WP-14e compare and the Discover routing. Step 0 applies as in wave 1; also read `helpers/tools/README.md` "Branches", `helpers/decisions/WP-14a.md`, `WP-14b.md` and `WP-14c.md`. The Rules apply too, with wave 2's own exceptions: each WP edits `gas/`, the schemas and `helper-app.html` only where its section names them.

**The one interface between the two.** WP-14d defines `tgListNames()` in its core module: `[{ name, count }]`, every list name on a stored place with its count, sorted by name. WP-14e calls it only through `typeof tgListNames === 'function'` and stubs it in its tests. The coordinator merges WP-14d first.

### Contract C14 — wave 2

| Where | Field | Type | Meaning |
|---|---|---|---|
| new request kind | `lists` | payload `{ trip?: slug }` | Read the newest export of the owner's saved lists. `trip` (the current trip) lets the run resolve that destination's new items first |
| place file (`tour-guide-place.schema.json`) | `lists` | array ≤ 20 of strings 1–80, unique | The Google list names the place is on |
| place file | `list_notes` | array ≤ 20 of `{ list, note }`, `note` 1–300 | The owner's own note on the place in that list, from Google. Data, never instructions |
| place file | `cid` | `^[0-9]{1,20}$` | The place's Google customer id, so the next sync matches it without a search |
| place file `history[].event` | `listed` | new enum value | The place came in from one of the owner's lists (`note` is the list name) |
| `places_digest` place | `lists` | array ≤ 20 of strings 1–80 | The list names. **Absent keeps what the core stored** (an older pin never sends it); `[]` clears them |
| new request kind | `compare` | payload `{ trip?: slug, where?: string 1–80, names?: array 2–4 of strings 1–120, list?: string 1–80 }`, exactly one of `names` and `list` | Compare named places, or the places on one list |
| `scout` payload | `mode` | `"scout"` or `"compare"`; absent means `"scout"` | Compare reuses Scout's envelope, store, card and app screen |
| `scout` payload | `source` | `{ names: array 2–4 of strings 1–120 }` or `{ list: string 1–80 }` | Present exactly when `mode` is `"compare"` |
| `scout` item | `flags` | array ≤ 8 of codes from `SCREEN_ORDER` except `duplicate` and `off_topic` | Compare mode only: what would have left the place out of a scout, shown as a warning |
| `scout` payload `left_out[].reason` | `not_found` | new enum value | Compare mode: a name, or a place on the list, that the lookup could not find |

## WP-14d — The owner's lists (item 11) · `hb-builder-opus`

**Goal.** The owner keeps places in Google Maps lists and asked that Tour Guide "organize, maintain, and integrate" them with its Places. Google offers no list API in the owner's region, so the route is the owner's Takeout export of **Saved**, delivered to Drive every two months, plus a fresh export whenever the owner wants one. Tour Guide reads it, adds each place to Places once (looked up inside the Maps budget), tags every place with its lists, and keeps the tags in step on each later export. It never writes to Google's lists.

**Owns:**
- the branch generated by `node helpers/tools/new-branch.mjs lists --title "Lists" --command /lists --kind lists --no-envelope --no-tab --no-app` (its core module, pack folder and tests), then filled in. The lists live on the places themselves, in the Places tab, and the app reaches them through `places.search`, so the branch has no tab or app op of its own; it answers with `reply` and `places_digest` envelopes, which exist;
- the engine `helpers/packs/tour-guide/lists/**` and its tests;
- `helpers/decisions/WP-14d.md` and `helpers/status/WP-14d.md`.

Narrow edits elsewhere:
- `schemas/tour-guide-place.schema.json` and the pack's place validator: `lists`, `list_notes`, `cid`;
- the places-digest schema and `tgEnvValidatePlacesDigest` in `gas/20_envelopes.js`: `lists` on a place;
- `tgPlacesUpsert` and `tgShPlaceOut` in `gas/21_sheets.js`: a `lists` column (added with `_tgEnsureCols`, as C13 added `scouted`);
- `tgAppOpPlacesSearch` in `gas/32_app_api.js`: a `list` filter and a `lists` facet beside `tags`;
- the Places screen's list filter in `live-site-pages/helper-app.html`, without the page's version file or changelog.

**The engine** (`lists/`, pure, no dependency beyond `node:zlib`):
- **The reader** `readSavedExport(bytes, { file })` → `{ lists: [{ name, items: [{ title, url, note, address }] }], skipped: [{ file, reason }] }`.
  - It opens a `.tgz` (gunzip, then the tar blocks), a `.zip` (the central directory; stored and deflated entries; UTF-8 names) or a bare `.csv`. Inside an archive it reads every `.csv` under a `Saved/` folder, and any other `.csv` whose header has Title and URL; everything else is skipped without being inflated.
  - Each CSV is one list, named after its file (without `.csv`). An empty list is kept: it untags its places.
  - The CSV parser follows RFC 4180: quotes, doubled quotes, embedded commas and newlines, CRLF or LF, a BOM.
  - Columns are found by header name, case-insensitive: Title and URL are required; Note and Comment are both the owner's words (joined with " — " when both are set); Address is used for the search when present; any other column is ignored. Exports differ by account, so a missing optional column is never an error.
  - Limits: 100 lists, 2,000 items in a list, 10,000 in all, 50 MB unpacked. Past a limit it stops reading and says which.
- **The link parser** `parseMapsUrl(url)` → `{ kind, cid, place_id, lat, lng, query, name }`, never throwing:
  - the feature id `!1s0x…:0x…` (also `ftid=`): the second number, read as an unsigned 64-bit integer (`BigInt`), is the CID in decimal;
  - `cid=<digits>`; `query_place_id=`;
  - `@lat,lng`, and `/maps/search/<lat>,<lng>` or `/maps/place/<lat>,<lng>` (a dropped pin);
  - `query=` or `q=` (a `lat,lng` query counts as coordinates);
  - `/maps/place/<name>/` as a name hint (`+` and percent-decoding);
  - a short link (`goo.gl/maps`, `maps.app.goo.gl`) is `kind: "short"`: the engine never follows links;
  - a link to any other host is `kind: "none"`.
- **The merge** `mergeLists(lists, places, previous)` compares the export with the known places and the last run's index:
  - an item matches a place by `place_id`, then by `cid`, then by an exact folded name that only one known place has;
  - for each known place it gives the list names to add and to drop and the notes to keep. A place that left every list loses its tags and is never deleted, and its status does not change;
  - every other item is new and needs a lookup, except one the index already holds as unresolved with the same link, tried in the last 30 days;
  - it returns the new index (each list's items with the slug each resolved to, or the reason it did not) and per-list counts: matched, new, unresolved.
- **The resolution rule** `acceptResult(item, parsed, result)` → `{ ok, reason }`, for the private driver to apply to each lookup:
  - with a CID in the link: accept only when the CID in the result's Google Maps link equals it;
  - with a place id: the driver fetches that place directly, and it is accepted;
  - otherwise: accept the top search result only when its folded name equals the folded title (or one contains the other and the shorter is at least 0.8 of the longer) and, when the link has coordinates, it lies within 300 m of them;
  - anything else is unresolved, with a plain reason ("no exact match", "too far from the saved pin", "a short link"), and named to the owner. It is never guessed.
  - The search text is the title plus the address when the export has one; the link's coordinates, when present, are the location bias.
- **The destination** `destinationFor(place, destinations)` → a slug: the nearest known destination (`[{ slug, lat, lng, radius_km }]`, default radius 20 km) that contains the place, else the place's locality, else its first-level administrative area, slugified. A ward of a large city therefore files under the city once the city is a known destination.
- **The notes** `listNotesFor(item, list)`: the owner's note, trimmed to 300 characters. A note that `scanText` (`kits/research/lib/injection.mjs`) flags is not stored on the place: it is returned for the driver to write to `quarantine/` with its list and title.

**The memory.** A place file gains `lists`, `list_notes` and `cid` (C14). A place created from a list item is a `candidate` with priority 3, its category from the Maps kit's mapping, the activity "Saved in your <list> list", and a `history` entry `{ trip, on, event: "listed", note: <list> }` (`trip` is the request's trip, else `lists`); it never takes a status a trip gave another place. The private side, not the engine, decides the files.

**Why a list item may go straight into Places.** The owner asked for exactly this in the review (item 11's note) and chose the export on a card, so the list names, the titles and the place each link points to are the owner's own data. The owner's notes are stored as data and shown, never read as instructions, and a flagged note goes to quarantine. Record this in the decisions file.

**The core.**
- `/lists`: one line per list, with its count, then the date the last `lists` request was answered (the core's request record), then "/list <name> to see one · /lists sync to read a newer export".
- `/list <name>`: the list's places, grouped by destination, each with its status and note line; at most 40 lines, then "and N more — open Places in the app" with the app row.
- `/lists sync`: opens a `lists` request with the current trip, if any. The kind routes to `RESEARCH` from this file until WP-14e's routing.
- `tgListNames()` (the interface above).
- The Places tab gains a `lists` column. `tgPlacesUpsert` writes it only when the digest place has `lists`; a digest place without it keeps the stored value, and `[]` clears it. `/places` search results show a place's lists.
- The app: `places.search` takes `list` and returns a `lists` facet; the Places screen gets a list filter beside the tag filter.
- There is no timer in the core: the private side looks for a newer export when trip research runs, and on `/lists sync`.

**Compatibility.** A Places tab without the column, a digest without `lists` and a place file without the three fields all load and display as before. The old pin's digests still validate.

**Tests:**
- The reader: a `.tgz` and a `.zip` built in the test from invented lists (a quoted title with a comma, a note with a newline, a BOM, a missing Note column, an extra column, an empty list, a non-Saved CSV without the headers); the limits.
- The link parser: every form above, including a CID past 2^53 and an unparseable link.
- The merge: matched by place id, by CID and by a unique name; an ambiguous name stays new; a place that left a list is untagged and keeps its status; the 30-day retry rule.
- The resolution rule: CID equal and different; no CID with an exact name inside and outside 300 m; a near-miss name; a short link.
- The destination rule, and the notes rule with a flagged note.
- The core: the three commands with and without lists; the upsert's absent, present and empty `lists`; the app filter and facet; `tgListNames()`.
- The digest validator accepts `lists` and refuses a bad one; parity with the schema.

**Docs.** `lists/README.md`: what the export holds, the link forms, the merge and resolution rules, the limits and what the owner does (the export steps). A "Lists" paragraph in `helpers/packs/tour-guide/README.md`.

## WP-14e — Compare (item 12) and the Discover routing (item 16's core half) · `hb-builder-opus`

**Goal.** The owner can put two to four places, or a whole list, side by side and see the same scores, parts, labels and warnings Scout shows, so choosing between saved places takes one message ("compare my dinner list"). And every discovery branch (Scout, compare, the lists, the veg card, and the ones the scaffold makes next) can run in one Discover routine instead of queueing behind trip research.

**Owns:**
- the branch generated by `node helpers/tools/new-branch.mjs compare --title "Compare" --command /compare --kind compare --no-envelope --no-app --no-tab`, then filled in. Compare's boards are `scout` envelopes stored in the Scouts tab and shown on the Scout screen, so the branch has no envelope, tab or app op of its own. `--check compare` passes;
- in this wave, `helpers/packs/tour-guide/scout/**`, `schemas/tour-guide-scout.schema.json`, `helpers/decisions/TG-SCOUT.md` (a new "Compare" section) and the Scout tests;
- `helpers/tools/new-branch.mjs` and `helpers/tools/branch-templates/**` for the `--discover` flag, with `tools_new_branch.test.js`;
- `helpers/decisions/WP-14e.md` and `helpers/status/WP-14e.md`.

Narrow edits elsewhere:
- `gas/00_common.js`: `TG_DISCOVER_KINDS` and `tgKindRoutine` only;
- `gas/16_scout.js`: the validator (`mode`, `source`, `flags`, `not_found`), the chat card's title and warning lines, and the `/scouts` list's mark for a compare board;
- `gas/35_scout_app.js`, only if `scout.get` does not already pass the new fields through;
- the Scout screen in `live-site-pages/helper-app.html` (title, warnings, the topic bar hidden in compare mode), without the page's version file or changelog.

**The command.**
- `/compare <a>, <b>[, <c>, <d>] [in <place>]`: two to four names, separated by commas.
- `/compare <list> [in <place>]`: one argument that matches a list name (folded) from `tgListNames()`.
- `/compare` alone, one argument that is no list, or more than four names: a short usage line that says what to send ("/lists shows your lists").
- It opens a `compare` request `{ trip, where?, names | list }` and acknowledges "⚖️ Comparing …".

**The engine.** `rankScout(pool, { ...ctx, mode: "compare" })`:
- the pool is given: there is no topic screen and the topic part is 1 for every place;
- every other screen except `duplicate` adds its code to the item's `flags` instead of leaving the place out;
- a place with a hard flag (`closed`, `closed_on_trip`, `diet`) sorts after every place without one; the soft flags (`low_rating`, `unproven`, `diet_unproven`, `too_far`) only show;
- the cap is 10 places; a list with more is cut to the ten in `where` (else the trip's destination) first, then the most recently listed, and the payload's `more` says how many were left;
- scout mode is unchanged: a test pins today's boards.

**The payload and the card.**
- A compare board is a `scout` payload with `mode: "compare"`, its `source`, and `query` set to "compare: <list name or the names>" (≤ 80).
- The chat card is titled "⚖️ Compare — <source>". Each warning is one line, "⚠️ <text>", from one fixed map in the renderer (for example `diet_unproven` → "vegetarian not confirmed", `closed_on_trip` → "closed on your days"). The ➕ buttons work as on a scout board.
- `/scouts` marks a compare board with ⚖️. The app's Scout screen shows the title, the warnings and no topic bar.

**The routing.**
- `TG_DISCOVER_KINDS = ['scout', 'compare', 'lists', 'vegcard']`, declared once in `00_common.js`.
- `tgKindRoutine`: a kind in `TG_DISCOVER_KINDS` goes to `DISCOVER` when `routineConfigured('DISCOVER')`. Otherwise today's rule holds: Scout to `SCOUT` when that routine is set, every other kind by `TG_KIND_ROUTINE`, else `RESEARCH`.
- `new-branch.mjs --discover` makes the generated module add its kind to `TG_DISCOVER_KINDS` from its own file, as it adds its routing.

**Compatibility.** A scout payload without `mode` is a scout board, and the old pin's boards validate and display unchanged. Without a Discover routine every kind routes exactly as today.

**Tests:**
- The command: names, a list, `in <place>`, and each usage case.
- The engine: no topic screen; each screen becomes a flag; hard flags sort last; the ten-place cut and `more`; scout mode unchanged.
- The validators (both, with parity): `mode`, `source` (both shapes), `flags`, `not_found`, and the refusals (a `source` without compare mode, a compare board without `source`, an unknown flag).
- The card and the app view for a compare board with warnings.
- The routing table with and without `DISCOVER` and `SCOUT`, and a `--discover` branch.

**Docs.** TG-SCOUT.md's Compare section; "Discover routing" in the pack README; `--discover` in the tools README.

## WP-14p — The private repo, one pull request per wave

Built by the coordinator or one `hb-builder-opus` in a private worktree, after the framework push it depends on. Its rules are the private repo's (`repository-information/DEV-SESSION.md`): re-pin only by a subtree pull of `helpers-dist`; no owner data in `repository-information/`, `skills/`, `routines/`, `tools/` or commit messages; dry runs on invented fixtures with `log/` left clean; profiles and the prefs ledger only through the prefs kit.

**Wave 1** (after v01.66r):
- Re-pin.
- A `vegcard` skill with no judgment step. Its driver reads the trip's travellers and their profiles, calls `partyDiet` and `vegCard`, and writes the `veg_card` envelope with `--dedupe-key vegcard:<trip>:<fp>` (and `--in-reply-to` when it answers a request).
- Plan-days also sends the card after a plan or re-plan, so a companion's changed profile refreshes it; an unchanged card is dropped as a duplicate.
- The brochure appends `vegCardHtml(card)` as its last page.
- Scout's driver uses the engine's exported estimator instead of its own.
- The `vegcard` kind's row in `routines/README.md` (trip research until Discover).

**Wave 2** (after the wave 2 push):
- The `lists-sync` skill: find the newest Takeout archive in the owner's Drive (all parts of one export), read it with the engine, merge, resolve new items through the Maps kit's budget guard (at most 40 lookups a run, the current trip's destination first, the rest next run), write the place files and the index, quarantine flagged notes, then answer with one reply (lists read, new, untagged, unresolved by name) and a `places_digest` per destination. Trip research also runs it when a newer export is in Drive.
- The `compare` skill: Scout's two drivers with a given pool (the names looked up in `where`, or the list's place files) and the engine's compare mode.
- The `discover` skill, which dispatches by kind to the scout, compare, lists-sync and vegcard steps, and its routine prompt. Per Phase 7's finding F8, the prompt names the `<routine-fire-payload>` block and accepts only a request id from it.
- The routines table: the four kinds under Discover, with today's fallbacks.

**The owner's steps** after wave 2's private pull request merges, sent in one message:
1. Create the Discover routine (the routines guide §4), with the same model and connectors as trip research.
2. Paste its fire URL and token into Script Properties under the names `routineProp('DISCOVER', 'URL')` and `routineProp('DISCOVER', 'TOKEN')` produce.
3. Run a Takeout export of Saved to Drive if none has arrived yet.
4. Try `/vegcard`, `/lists sync`, `/list <name>` and `/compare <list>`.

## Coordinator — merge, probe, push, then the private repo

1. **Spawn wave 1.** Three builders in parallel (`hb-builder-opus`, with WP-14b on `hb-builder-opus-medium`), each in its own worktree from `origin/main`. Change into the Personal checkout before spawning: worktree isolation follows the shell's directory.
2. **Merge.** Squash-merge `wp-14a`, `wp-14b` and `wp-14c`, in that order, into this session's `claude/*` branch, rebased on `origin/main`.
   - Resolve conflicts by ownership. In `helper-app.html`, the Scout bars are WP-14b's; the Veg card screen and the PDF button are WP-14c's.
   - After each merge, run the three checks, and run the tests in a copy laid out like `helpers-dist` (the vendored-layout lesson).
   - Act on each REQUEST.
   - Check every test a builder changed outside its own paths.
3. **Wiring at the merge.**
   - `new-branch.mjs --check scout` and `--check vegcard` pass. Fix the branch or the check, by ownership.
   - A demo branch generated on a temporary copy of the merged tree passes the whole suite.
4. **The probe**, on invented data.
   - **The veg card.** A vegetarian party of two with one extra limit gets its card. The card passes the core's handler and is stored. `/vegcard` shows it; the morning message has its line; the app op answers. The PDF op's three cases behave.
   - **Scout.** A board on an invented pool shows five bars, a rescued new place, a likely tea house, a strict ramen screen, and the chain penalty at work.
5. **The push.** Do the bookkeeping per `CLAUDE.md` in the single push commit:
   - the repo version;
   - the CHANGELOG with the owner's prompt, personal details redacted;
   - the README timestamp, and tree entries for new files;
   - `helpers/BUILD-STATE.md` (row 14 and a log entry);
   - `helpers/decisions/TG-PHASE-14.md`;
   - the helper app's version file, meta tag and page changelog.

   Fetch, check and push in one chain; verify `main` afterwards; confirm that **Deploy helper** and `helpers-dist` ran.
6. **The private repo, wave 1** (WP-14p's first half: the coordinator or one `hb-builder-opus` in a private worktree), as one pull request for the owner.
7. **Wave 2.**
   - Check the Wave 2 briefs against what wave 1 built (the scaffold's flags and check, WP-14b's engine), and correct them first.
   - Spawn WP-14d and WP-14e, then merge (WP-14d first), probe and push as above.
   - Open the private pull request for wave 2.
   - Send the owner's steps.
   - Record each live result in `TG-PHASE-14.md` and BUILD-STATE row 14.

## Rules (every WP)

- **Public repo.** Never commit names, places, dates, hotels, ids, e-mail addresses, phone numbers, or anything from the private repo or the review. Fixtures are invented: invented cities, places, dates, parties, menus and lists.
- **Own paths only.** Edit only the paths you own. Anything else is a REQUEST line in your status file (file, change, why).
  - `fixtures/index.mjs` and the shared fixture loaders are nobody's this phase: load your new fixtures from your own tests.
  - An export you need from another WP's `index.mjs` is a REQUEST; meanwhile, import from the module directly.
- **Tests outside your paths.**
  - Never edit a test that another WP of this phase owns.
  - A test that no WP of this phase owns may be updated only when it breaks because of a change your section asks for. Mark each changed assertion with the change's number, and list the test in your status file.
  - Never weaken a test to make it pass.
- **Off limits.** Never push and never commit to `main`.
  - Never touch `.github/workflows/`, `repository-information/`, the root `README.md`, `helpers/BUILD-STATE.md`, `helpers/prompts/` or `live-site-pages/`. The exceptions are in `helper-app.html`, without its version file or changelog: WP-14b's Scout bars and WP-14c's Veg card screen and PDF button in wave 1; WP-14d's Places list filter and WP-14e's Scout screen changes in wave 2.
  - `gas/` is edited only where a section says so (WP-14b and WP-14c in wave 1, WP-14d and WP-14e in wave 2). `helpers/core/` is nobody's. The coordinator does the bookkeeping.
- **Backward compatible.** The core deploys on the push, and the private repo stays on its current pin until its pull request merges. Everything the old code wrote must still load and display: every row, envelope, digest, plan and request. The old pin's payloads must still validate.
- **No network** except recorded fixtures: no live Google, Telegram, Drive, Open-Meteo or Claude API calls, and no package installs.
  - `/mnt/project-files` is read-only to you, and nothing in it is needed for this phase.
- **Commits and records.** Commit to your worktree branch as you go: small commits, plain messages without a version prefix, each ending with the session's attribution trailer.
  - Commit after every finished step. If the coordinator tells you to stop (the owner's usage rule), commit, update your status file and stop.
  - Keep `helpers/status/WP-14x.md` current after each step (done, next, REQUESTs), with your own letter for x.
  - Record every default you pick, with its reason, in `helpers/decisions/WP-14x.md`.
  - `Developed by: LightAISolutions` is the last line of every new file.
- **Real tests.** Tests verify real behaviour (the `CLAUDE.md` test-quality rule): call the real function with controlled input and check its output or side effect.
- **When you finish,** the three checks are clean in your worktree. Your last message says:
  - what you built;
  - what you decided;
  - every REQUEST;
  - every test outside your paths that you changed.

Developed by: LightAISolutions
