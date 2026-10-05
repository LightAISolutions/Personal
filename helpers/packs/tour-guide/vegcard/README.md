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
import { partyDiet, dietOf, mealPrefsOf } from '../travellers/index.mjs';
import { vegCard, validateVegCardPayload } from './index.mjs';
const members = [owner, ...companions].map((md) => ({ ...dietOf(md), ...mealPrefsOf(md) }));   // owner first; {} for a companion with no profile
const party = { ...partyDiet(members), size: 1 + companions.length, members };
const card = vegCard({ party, country: trip.country, trip: trip.slug });
// card === null → the party has no diet and no limit: write nothing.
// else: node vendor/helpers/tools/envelope.mjs veg_card <skill> card.json --pack tour-guide --dedupe-key vegcard:<trip>:<fp>
```

The core stores the card in its `VegCards` tab (one row per trip) and sends it to the owner when it answers an open
`vegcard` request or when its `fp` changed; an unchanged card is stored silently. `/vegcard` shows the stored card,
`/vegcard rebuild` asks for a new one, the morning message links it, and the app has a full-screen view.

## Composition

- **Each limit is said for the person who has it.** With `party.members` (one `dietOf()` result per traveller, owner
  first) the card speaks in one voice only when that is true: everyone says the same thing ("we", the card as it was),
  or only the owner has limits ("I", even when companions travel). Otherwise it is a per-person card: the owner is "I";
  companions who say the same thing speak as one group, "my companion" (one companion), "all my companions", "one of
  my companions" or "2 of my companions"; a traveller with nothing to say is left out.
- On a per-person card the strictest diet is the card's `diet`. When everyone keeps it, "we" say it once; else the
  owner opens when they keep a diet (otherwise the first group with the strictest), and every other group says its
  diet ("my companion is vegetarian and…") and its own limits ("my companion cannot have eggs"; "…also
  cannot have…" after a diet). `ok` and the questions hold for everyone: the strictest diet's, minus
  every extra limit, plus one "Does this dish contain …?" for the extra limits the diet's questions do not ask.
- **Mealtime preferences ride along.** A member's `mealPrefsOf()` values add one line per preference at the end of
  `avoid`, after every limit: mild food (辛いものが苦手です / "prefers mild food, not spicy") and no alcohol
  (お酒を飲みません / "does not drink alcohol": drinks only; food cooked with alcohol is the `alcohol` limit). "We" when
  everyone has it, else "I" for the owner and one line for the companions who have it. They never make a card on
  their own, and they are left out when they would break C14's bounds.
- A card that would not fit C14's bounds per person (more than 12 lines in a section, 12 English-only words, 12
  travellers, or the 8 000-character payload) is the merged card instead: everyone's limits in one voice, stricter for
  each, never looser.
- Without `members` the party is one voice: the diet is the strictest member's (`partyDiet`), and what the cannot-eat
  values themselves say. A party of one is "I", more is "we".
- Sections, in order: `intro`, `avoid`, `ok` (vegetarian and vegan parties only), `ask`, `thanks`. An empty section is
  left out.
- A limit the diet already says is not repeated (vegetarian covers meat, fish, seafood and shellfish; vegan also
  covers eggs and dairy; seafood covers shellfish; meat covers pork, beef and chicken).
- A cannot-eat value with no phrase goes to `english_only`: the card shows it in English, "show this in a
  translation app". On a per-person card each word says whose it is ("Me: …", "My companion: …"), clipped to 60.
- A country with no phrase table gives an English-only card (`lang` and every `local` null).

## The fingerprint

`vcf1:` and the FNV-1a (32-bit, lower-case hex) of
`v1|<lang or ->|<diet or ->|<one or many>|<extra avoid keys, sorted>|<english_only, lower-cased, sorted>`, and on a
per-person card `|m:` and its groups' signatures (`o` or `c<k>/<n>`, then diet, extra limits and words), sorted and
joined by `;`: moving a limit from one person to another changes it, the companions' order does not. A card with
preference lines then appends `|p:` and their signatures (`spice.mild:c1/1`, `drinks.none:all`…), sorted and joined by
`;`. A one-voice card without preferences keeps the C14 string as it was. Only the engine computes it. The routine sends the card with `dedupe_key` `vegcard:<trip>:<fp>`.

Developed by: LightAISolutions
