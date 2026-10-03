/**
 * Tour Guide pack — one excerpt for the people travelling together (Phase 8: "their limits, your lead").
 *   partyDiet([dietOf(...)...]) → { dietary, diet, rule, avoid_types, drop_food } — the union of every cannot-eat and the strictest diet
 *   partyExcerpt(owner, companions) → the owner's excerpt with:
 *     dietary  the union of everyone's cannot-eat; diet / diet_rule the strictest (a vegan companion makes the food group vegan)
 *     avoid    the union of everyone's must-avoid and mobility limits
 *     pace     the most relaxed of all (a day the slowest walker can keep)
 *     interests the owner's alone (the owner leads); a companion's high interests the owner did not rate become `also_like`
 *     party    how many travel (owner + companions)
 * Companions' tastes never lower the owner's interests; their limits always bind. Pure; no names in the result.
 */
import { DIET_ORDER, DIET_RULES, dietFromValues, dietRule } from './travellers-excerpt.mjs';

const PACE_ORDER = ['relaxed', 'normal', 'packed'];
const strictest = (diets) => diets.reduce((a, d) => (DIET_ORDER.indexOf(d || null) > DIET_ORDER.indexOf(a) ? d || null : a), null);

export function partyDiet(diets) {
  const all = (diets || []).filter(Boolean);
  const dietary = [...new Set(all.flatMap((d) => d.dietary || []))];
  const diet = strictest([...all.map((d) => d.diet || null), dietFromValues(dietary)]);
  return { dietary, diet, ...dietRule(diet) };
}

export function partyExcerpt(owner, companions = []) {
  const others = (companions || []).filter((c) => c && typeof c === 'object');
  const out = { ...owner, interests: { ...(owner.interests || {}) }, meals: { ...(owner.meals || {}) }, avoid: [...(owner.avoid || [])], dietary: [...(owner.dietary || [])] };
  if (!others.length) return out;
  for (const c of others) {
    for (const v of c.dietary || []) if (!out.dietary.includes(v)) out.dietary.push(v);
    for (const v of c.avoid || []) if (!out.avoid.includes(v)) out.avoid.push(v);
    if (PACE_ORDER.indexOf(c.pace) >= 0 && PACE_ORDER.indexOf(c.pace) < PACE_ORDER.indexOf(out.pace)) out.pace = c.pace;
  }
  const diet = strictest([owner.diet || null, ...others.map((c) => c.diet || null), dietFromValues(out.dietary)]);
  if (diet) { out.diet = diet; out.diet_rule = DIET_RULES[diet].rule; }
  const also = [...new Set(others.flatMap((c) => Object.entries(c.interests || {}).filter(([k, v]) => v === 'high' && !(k in out.interests)).map(([k]) => k)))];
  if (also.length) out.also_like = also.sort();
  out.party = 1 + others.length;
  return out;
}

// Developed by: LightAISolutions
