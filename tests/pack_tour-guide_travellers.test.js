'use strict';
// packs/tour-guide/travellers — the engine's profile-excerpt from a rendered travel profile, and the party excerpt for the
// people travelling together (Phase 8, F12: the dietary limits are part of the schema and never dropped).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = () => import('../packs/tour-guide/travellers/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');

// A profile shaped as the prefs kit renders it (invented content).
const OWNER = `# Travel profile

## Pace
- relaxed — fewer stops

## Early or late
- early

## Interests
- likes "temples and shrines"
- likes "gardens"
- avoid "nightlife"

## Must avoid
- never "long queues"
- fine with "crowds at dawn"

## Mobility
- avoid "steep stairs"

## Dietary
- cannot eat "meat and fish" — vegetarian

<!-- prefs:end -->
`;
const COMPANION = `## Pace
- normal

## Interests
- likes "museums"
- likes "gardens"
- avoid "temples"

## Must avoid
- never "boats"

## Dietary
- cannot eat "animal products"
- cannot eat "peanuts"
`;

test('the excerpt carries every dietary limit and the diet it amounts to, and validates', async () => {
  const { profileExcerpt } = await P(); const { validate } = await S();
  const x = profileExcerpt(OWNER);
  assert.deepEqual(x, { pace: 'relaxed', interests: { church: 'high', park: 'high', nightlife: 'low' }, meals: { breakfast_at_lodging: true },
    avoid: ['long queues', 'steep stairs'], day_rhythm: 'early', dietary: ['meat and fish'], diet: 'vegetarian',
    diet_rule: 'vegetarian: no meat, poultry, fish or seafood (dashi, fish sauce and meat broth count)' });
  assert.deepEqual(validate(x, 'profile-excerpt'), { ok: true, errors: [] });
});

test('dietary is always present and required: an empty profile gives [], an excerpt without it is refused', async () => {
  const { profileExcerpt } = await P(); const { validate } = await S();
  const x = profileExcerpt('');
  assert.deepEqual(x.dietary, []);
  assert.equal(x.diet, undefined);
  assert.ok(validate(x, 'profile-excerpt').ok);
  const { dietary, ...without } = x;
  assert.ok(!validate(without, 'profile-excerpt').ok);
  assert.ok(!validate({ ...x, diet: 'pescatarian' }, 'profile-excerpt').ok);
});

test('a trip override can add a dietary limit but never lift one', async () => {
  const { profileExcerpt } = await P();
  const x = profileExcerpt(OWNER, { pace: 'packed', dietary: [], interests: { museum: 'high' } });
  assert.equal(x.pace, 'packed');
  assert.deepEqual(x.dietary, ['meat and fish']);
  assert.equal(x.diet, 'vegetarian');
  const y = profileExcerpt(OWNER, { dietary: ['Dairy', 'eggs'] });
  assert.deepEqual(y.dietary, ['meat and fish', 'dairy', 'eggs']);
  assert.equal(y.diet, 'vegetarian');   // "meat and fish" + dairy + eggs is not the "meat" + dairy + eggs vegan rule: kept as written
  const z = profileExcerpt('', { dietary: ['vegan'] });
  assert.equal(z.diet, 'vegan');
});

test('dietOf: vegan and vegetarian readings, the place types and food words they rule out', async () => {
  const { dietOf } = await P();
  const v = dietOf(COMPANION);
  assert.deepEqual(v.dietary, ['animal products', 'peanuts']);
  assert.equal(v.diet, 'vegan');
  assert.ok(v.avoid_types.includes('seafood_restaurant') && v.drop_food.includes('bakeries'));
  assert.equal(dietOf('## Dietary\n- cannot eat "meat"\n').diet, 'vegetarian');
  assert.equal(dietOf('## Dietary\n- cannot eat "gluten"\n').diet, null);
  assert.deepEqual(dietOf('## Dietary\n- cannot eat "gluten"\n').avoid_types, []);
});

test('the party excerpt: everyone’s limits bind, the most relaxed pace, the owner’s interests lead', async () => {
  const { profileExcerpt, partyExcerpt, partyDiet, dietOf } = await P(); const { validate } = await S();
  const owner = profileExcerpt(OWNER), friend = profileExcerpt(COMPANION.replace('- normal', '- packed'));
  const p = partyExcerpt(owner, [friend]);
  assert.deepEqual(p.dietary, ['meat and fish', 'animal products', 'peanuts']);
  assert.equal(p.diet, 'vegan');
  assert.deepEqual(p.avoid, ['long queues', 'steep stairs', 'boats']);
  assert.equal(p.pace, 'relaxed');
  assert.deepEqual(p.interests, owner.interests);   // the companion's "avoid temples" does not lower the owner's
  assert.deepEqual(p.also_like, ['museum']);
  assert.equal(p.party, 2);
  assert.deepEqual(validate(p, 'profile-excerpt'), { ok: true, errors: [] });
  assert.deepEqual(partyExcerpt(owner, []), owner);
  assert.equal(partyExcerpt(profileExcerpt(''), [owner]).diet, 'vegetarian');
  const d = partyDiet([dietOf(OWNER), dietOf(COMPANION)]);
  assert.equal(d.diet, 'vegan');
  assert.deepEqual(d.dietary, ['meat and fish', 'animal products', 'peanuts']);
});
