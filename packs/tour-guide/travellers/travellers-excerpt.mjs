/**
 * Tour Guide pack — the engine's `profile-excerpt` from the prefs kit's rendered travel profile (Phase 8, F12; moved here
 * from the private repo so the hard dietary limits have a public test).
 *   dietOf(markdown) → { dietary: [cannot-eat values], diet: 'vegetarian'|'vegan'|null, rule, avoid_types, drop_food }
 *   profileExcerpt(markdown, overrides?) → { pace, interests, meals, avoid, dietary, day_rhythm?, diet?, diet_rule? }
 * Read from the sections ## Pace, ## Interests, ## Must avoid, ## Mobility, ## Early or late and ## Dietary; unknown → defaults.
 * `dietary` is always present (an empty list when nothing is ruled out): it is a hard limit, every food suggestion fits it.
 * A trip's `profile_overrides` win over the profile but can never remove a dietary limit. Pure; no network.
 */

/** Category words the engine knows (estimator categories) and the profile phrases that map onto them. */
export const CATEGORY_WORDS = Object.freeze({
  museum: ['museum', 'gallery', 'exhibit'], hike: ['hike', 'hiking', 'trail', 'walk in nature'], viewpoint: ['view', 'lookout', 'scenic'],
  market: ['market', 'bazaar', 'street food'], shop: ['shop', 'shopping', 'boutique'], neighbourhood: ['neighbourhood', 'neighborhood', 'old town', 'wander'],
  church: ['church', 'cathedral', 'temple', 'shrine'], park: ['park', 'garden'], beach: ['beach'], food: ['restaurant', 'food', 'cuisine', 'cafe', 'café'],
  nightlife: ['nightlife', 'bar', 'night market'], landmark: ['landmark', 'architecture', 'castle', 'palace'], nature: ['nature', 'wildlife', 'waterfall']
});

/**
 * Hard dietary limits (## Dietary, `cannot eat "<value>"`). The interview's "meat and fish" (and the older "meat") is read
 * as vegetarian: no meat, poultry, fish or seafood; "animal products" (or meat plus dairy and eggs) is vegan. `avoid_types`
 * are the Google place types a diet rules out of the food group outright; `drop_food` the food words that stop being search terms.
 */
const VEGETARIAN = Object.freeze({
  rule: 'vegetarian: no meat, poultry, fish or seafood (dashi, fish sauce and meat broth count)',
  avoid_types: Object.freeze(['steak_house', 'barbecue_restaurant', 'seafood_restaurant', 'sushi_restaurant', 'hamburger_restaurant', 'fish_and_chips_restaurant',
    'yakiniku_restaurant', 'yakitori_restaurant', 'chicken_restaurant', 'chicken_wings_restaurant', 'butcher_shop']),
  drop_food: Object.freeze(['seafood', 'grilled meat', 'raw fish'])
});
export const DIET_RULES = Object.freeze({
  vegetarian: VEGETARIAN,
  vegan: Object.freeze({ rule: 'vegan: no meat, poultry, fish, seafood, dairy or eggs', avoid_types: VEGETARIAN.avoid_types,
    drop_food: Object.freeze([...VEGETARIAN.drop_food, 'desserts', 'bakeries']) })
});
/** Strictness order: a party eats to its strictest member. */
export const DIET_ORDER = Object.freeze([null, 'vegetarian', 'vegan']);

const sectionOf = (md, label) => {
  const m = new RegExp(`^## ${label}\\s*\\n([\\s\\S]*?)(?=^## |<!--|$(?![\\s\\S]))`, 'm').exec(md);
  return m ? m[1] : '';
};

/** The diet a list of cannot-eat values amounts to. */
export function dietFromValues(dietary) {
  const has = (v) => dietary.includes(v);
  return has('vegan') || has('animal products') || (has('meat') && has('dairy') && has('eggs')) ? 'vegan'
    : has('meat') || has('meat and fish') || has('vegetarian') ? 'vegetarian' : null;
}
/** The rule, place types and food words of a diet (null → none). */
export function dietRule(diet) {
  const r = diet ? DIET_RULES[diet] : null;
  return { rule: r ? r.rule : null, avoid_types: r ? [...r.avoid_types] : [], drop_food: r ? [...r.drop_food] : [] };
}
export function dietOf(markdown) {
  const sec = sectionOf(String(markdown || ''), 'Dietary');
  const dietary = [...sec.matchAll(/^- cannot eat "?([^"—\n]+?)"?\s*(?:—|$)/gm)].map((x) => x[1].trim().toLowerCase());
  const diet = dietFromValues(dietary);
  return { dietary, diet, ...dietRule(diet) };
}

export function profileExcerpt(markdown, overrides = {}) {
  const md = String(markdown || '');
  const lines = (label) => sectionOf(md, label).split('\n').map((l) => /^- (likes|avoid|never|fine with|ok with)? ?"?([^"—]+)"?/.exec(l.trim()))
    .filter(Boolean).map((m) => ({ pol: m[1] || '', value: m[2].trim().toLowerCase() }));
  const out = { pace: 'normal', interests: {}, meals: { breakfast_at_lodging: true }, avoid: [] };
  const pace = /^- (relaxed|normal|packed)/m.exec(sectionOf(md, 'Pace')); if (pace) out.pace = pace[1];
  const rhythm = /^- (early|flexible|late)/m.exec(sectionOf(md, 'Early or late')); if (rhythm) out.day_rhythm = rhythm[1];
  for (const { pol, value } of lines('Interests')) {
    for (const [cat, words] of Object.entries(CATEGORY_WORDS)) if (words.some((w) => value.includes(w))) out.interests[cat] = pol === 'avoid' ? 'low' : 'high';
  }
  for (const { pol, value } of lines('Must avoid')) if (pol !== 'fine with') out.avoid.push(value);
  for (const { value } of lines('Mobility').filter((x) => x.pol === 'avoid')) out.avoid.push(value);
  const diet = dietOf(md);
  out.dietary = diet.dietary;
  if (diet.diet) { out.diet = diet.diet; out.diet_rule = diet.rule; }
  const o = overrides || {};
  if (['relaxed', 'normal', 'packed'].includes(o.pace)) out.pace = o.pace;
  if (o.interests && typeof o.interests === 'object') Object.assign(out.interests, o.interests);
  if (o.meals && typeof o.meals === 'object') Object.assign(out.meals, o.meals);
  if (Array.isArray(o.avoid)) out.avoid.push(...o.avoid.map(String));
  if (Array.isArray(o.dietary)) {   // an override can add a limit for this trip, never lift one
    for (const v of o.dietary.map((x) => String(x).trim().toLowerCase()).filter(Boolean)) if (!out.dietary.includes(v)) out.dietary.push(v);
    const d = dietFromValues(out.dietary);
    if (DIET_ORDER.indexOf(d) > DIET_ORDER.indexOf(out.diet || null)) { out.diet = d; out.diet_rule = DIET_RULES[d].rule; }
  }
  out.avoid = [...new Set(out.avoid)];
  return out;
}

// Developed by: LightAISolutions
