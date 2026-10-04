/**
 * Tour Guide — the veg card (`vegcard/`, TG-PHASE-14 WP-14c, Contract C14). Library only: plain Node ESM, no network,
 * no clock. The routine builds the card from the party's diet and sends it as a `veg_card` envelope.
 *
 *   import { vegCard, vegCardTelegram, vegCardHtml, validateVegCardPayload } from '…/packs/tour-guide/vegcard/index.mjs';
 *   import { partyDiet } from '…/packs/tour-guide/travellers/index.mjs';
 *   const party = { ...partyDiet([ownerDiet, ...companionDiets]), size: 1 + companions.length };
 *   const card = vegCard({ party, country: 'JP', trip: 'fernhollow-2027' });   // null → nothing to say, send nothing
 *   validateVegCardPayload(card);   // [] — then envelope.mjs veg_card … --pack tour-guide --dedupe-key vegcard:<trip>:<fp>
 */
export { vegCard, vegCardFp, classify, extraLimits, fnv1a, LANG_BY_COUNTRY, PHRASES, SECTION_IDS, DIETS, LINE_MAX, ENGLISH_ONLY_MAX, ENGLISH_ONLY_LEN, PARTY_MAX, PAYLOAD_MAX } from './vegcard.mjs';
export { vegCardTelegram, vegCardHtml, VEGCARD_CSS, TELEGRAM_HEADER, ENGLISH_ONLY_NOTE, NO_LANG_NOTE } from './vegcard-render.mjs';
export { validateVegCardPayload, checkVegCard, VEG_CARD_SCHEMA } from './vegcard-payload.mjs';

// Developed by: LightAISolutions
