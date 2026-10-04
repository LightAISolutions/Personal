/**
 * Tour Guide — Menu check (`menu/`, TG-PHASE-16 WP-16b, Contract C16). Library only — plain Node ESM, no network, no clock;
 * the private skill's drivers read the restaurant's own menu, make the judgment and pass the results in.
 *
 *   import { parseMenuText, menuPayload, menuFact, menuCounts, menuCountsFrom } from '…/packs/tour-guide/menu/index.mjs';
 *   const q = parseMenuText('/menu Brindle Lantern on 5/13', { today: '2027-05-10' });   // { ok, place, date }
 *   const payload = menuPayload({ trip, createdOn, date, place, checked, read, diet, dishes, others, sources });
 *   const fact = menuFact(payload);                                                        // the place's facts.menu
 *   // then tools/envelope.mjs menu … --pack tour-guide
 */
export { parseMenuText, PLACE_MAX } from './menu-text.mjs';
export { MENU, COURSES, DISH_FITS, FITS, MAX_AGE_DAYS, CAVEAT_RE, menuFits, menuNote, menuFact, menuCaveat, menuCounts, menuCountsFrom,
  sortDishes, cutWords } from './menu-check.mjs';
export { validateMenuPayload, checkMenu, menuId, menuPayload, MENU_SCHEMA, ID_RE, SLUG_RE, NOTE_MAX, PAYLOAD_MAX } from './menu-payload.mjs';

/** What the branch is wired as (the core module's @branch line says the same). */
export const BRANCH = Object.freeze({ name: 'menu', command: '/menu', kind: 'menu', envelope: 'menu', tab: 'Menus', routine: 'RESEARCH', discover: true });

// Developed by: LightAISolutions
