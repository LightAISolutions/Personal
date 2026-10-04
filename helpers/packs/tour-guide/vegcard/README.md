# vegcard/ — the party's veg card

TG-PHASE-14 WP-14c, Contract C14. The party's hard dietary limit is the one Google cannot check, and the moment it fails
is at the counter, in the local language, possibly with no signal. One card, in the destination's language and English,
says what the party does not eat, with the polite phrasing a server expects and the three questions asked most.

| File | What |
|---|---|
| `vegcard-phrases.json` | The phrase table: every line on a card. Japanese in the polite です/ます form, with the explicit list of what is not eaten (in Japan "vegetarian" alone is often taken to allow fish stock). |
| `vegcard.mjs` | `vegCard({ party, country, trip })` → the `veg_card` payload (or `null`: nothing to say); `vegCardFp`; `LANG_BY_COUNTRY` (`JP` → `ja`). |
| `vegcard-render.mjs` | `vegCardTelegram(card)` (chat HTML) and `vegCardHtml(card)` (a printable brochure-style section). |
| `vegcard-payload.mjs` | `validateVegCardPayload(p)` → `string[]`, mirrored by the core's `tgEnvValidateVegCard` (gas/27_vegcard.js). |
| `vegcard-fixture-party.json` | Invented parties for the tests. |

## How the routine uses it

```js
import { partyDiet } from '../travellers/index.mjs';
import { vegCard, validateVegCardPayload } from './index.mjs';
const party = { ...partyDiet([ownerDiet, ...companionDiets]), size: 1 + companions.length };
const card = vegCard({ party, country: trip.country, trip: trip.slug });
// card === null → the party has no diet and no limit: write nothing.
// else: node vendor/helpers/tools/envelope.mjs veg_card <skill> card.json --pack tour-guide --dedupe-key vegcard:<trip>:<fp>
```

The core stores the card in its `VegCards` tab (one row per trip) and sends it to the owner when it answers an open
`vegcard` request or when its `fp` changed; an unchanged card is stored silently. `/vegcard` shows the stored card,
`/vegcard rebuild` asks for a new one, the morning message links it, and the app has a full-screen view.

## Composition

- The diet is the strictest member's (`partyDiet`), and what the cannot-eat values themselves say. A party of one is
  "I", more is "we".
- Sections, in order: `intro`, `avoid`, `ok` (vegetarian and vegan parties only), `ask`, `thanks`. An empty section is
  left out.
- A limit the diet already says is not repeated (vegetarian covers meat, fish, seafood and shellfish; vegan also
  covers eggs and dairy; seafood covers shellfish; meat covers pork, beef and chicken).
- A cannot-eat value with no phrase goes to `english_only`: the card shows it in English, "show this in a
  translation app".
- A country with no phrase table gives an English-only card (`lang` and every `local` null).

## The fingerprint

`vcf1:` and the FNV-1a (32-bit, lower-case hex) of
`v1|<lang or ->|<diet or ->|<one or many>|<extra avoid keys, sorted>|<english_only, lower-cased, sorted>`.
Only the engine computes it. The routine sends the card with `dedupe_key` `vegcard:<trip>:<fp>`.

Developed by: LightAISolutions
