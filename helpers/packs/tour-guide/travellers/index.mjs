/**
 * Tour Guide pack — the travel profile as the engine reads it (Phase 8).
 *   import { profileExcerpt, dietOf, partyExcerpt, partyDiet, CATEGORY_WORDS, DIET_RULES } from '…/packs/tour-guide/travellers/index.mjs';
 * travellers-excerpt.mjs reads one rendered profile; travellers-party.mjs folds the companions on a trip into the owner's excerpt.
 */
export { CATEGORY_WORDS, DIET_RULES, DIET_ORDER, dietFromValues, dietRule, dietOf, profileExcerpt } from './travellers-excerpt.mjs';
export { partyDiet, partyExcerpt } from './travellers-party.mjs';

// Developed by: LightAISolutions
