'use strict';
// packs/tour-guide/vegcard — the veg card engine (TG-PHASE-14 WP-14c, Contract C14): the phrase table covers every
// cannot-eat value the prefs kit can produce, the four composition cases, the per-person card (party.members: each
// limit said for the person who has it), the fingerprint, escaping, bounds and the pack validator. Invented parties
// only (vegcard/vegcard-fixture-party.json).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const PACK = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const V = () => import('../packs/tour-guide/vegcard/index.mjs');
const P = () => import('../packs/tour-guide/travellers/travellers-party.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));
const FIX = read(PACK, 'vegcard', 'vegcard-fixture-party.json');
const clone = (x) => JSON.parse(JSON.stringify(x));
/** The fixture's card: the merged party as before, or with `members` the per-person card. */
async function cardFor(name, { members = false } = {}) {
  const [{ vegCard }, { partyDiet }] = await Promise.all([V(), P()]);
  const f = FIX[name];
  const party = { ...partyDiet(f.members), size: f.members.length, ...(members ? { members: f.members } : {}) };
  return vegCard({ party, country: f.country, trip: f.trip });
}
const sec = (card, id) => card.sections.find((s) => s.id === id);
const en = (card, id) => (sec(card, id) ? sec(card, id).lines.map((l) => l.en) : []);
const ja = (card, id) => (sec(card, id) ? sec(card, id).lines.map((l) => l.local) : []);

test('every cannot-eat example of the travel vocabulary and every food-03 option maps to a diet or an item', async () => {
  const { classify } = await V();
  const vocab = read(H.HELPERS_ROOT, 'kits', 'prefs', 'presets', 'travel.vocab.json');
  const examples = vocab.dimensions.find((d) => d.id === 'dietary').examples;
  const interview = read(H.HELPERS_ROOT, 'kits', 'prefs', 'presets', 'travel.interview.json');
  const options = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (o.qid === 'food-03') options.push(...o.options.map((x) => x.value));
    Object.values(o).forEach(walk);
  })(interview);
  assert.ok(examples.length >= 10 && options.length >= 10, 'both lists were found');
  for (const v of [...examples, ...options]) {
    const k = classify([v]);
    assert.deepEqual(k.english_only, [], `${v} has a phrase`);
    assert.ok(k.diet || k.avoid.length === 1, `${v} names a diet or one item`);
  }
  assert.equal(classify(['meat and fish']).diet, 'vegetarian');
  assert.equal(classify(['animal products']).diet, 'vegan');
  assert.deepEqual(classify(['Chicken ', 'WHEAT']).avoid, ['poultry', 'gluten'], 'aliases, case and spaces');
  const odd = classify(['lupin beans', 'Lupin  beans', 'x'.repeat(80), 'nuts']);
  assert.deepEqual(odd.avoid, ['nuts']);
  assert.deepEqual(odd.english_only, ['lupin beans', 'x'.repeat(60)], 'unknown values land in english_only, de-duplicated and clipped');
});

test('every Japanese line keeps the polite form and every line has both languages', async () => {
  const { PHRASES } = await V();
  for (const [key, t] of Object.entries(PHRASES.lines)) {
    for (const s of typeof t.ja === 'string' ? [t.ja] : Object.values(t.ja)) assert.match(s, /(です|ます|ません|ください|ますか)[。？]$/, key);
    for (const s of typeof t.en === 'string' ? [t.en] : Object.values(t.en)) assert.ok(s.length > 0 && s.length <= 200, key);
  }
  assert.equal(PHRASES.lines['intro.vegetarian'].ja.one, '私はベジタリアンです。肉・魚・魚介類は食べられません。', 'the table is the brief\'s, copied as written');
  assert.equal(PHRASES.lines['avoid.sauces'].ja, '魚醤、オイスターソース、肉のスープ（ガラスープ・ブイヨン）、ラード、ゼラチンもだめです。');
});

test('a vegetarian party of two with nuts: "we", the three avoid lines plus an "also" line, eggs and dairy are fine', async () => {
  const { validateVegCardPayload } = await V();
  const c = await cardFor('vegetarian_pair_nuts');
  assert.deepEqual(validateVegCardPayload(c), []);
  assert.equal(c.trip, 'fernhollow-2027');
  assert.equal(c.lang, 'ja');
  assert.equal(c.diet, 'vegetarian');
  assert.equal(c.party, 2);
  assert.deepEqual(c.sections.map((s) => s.id), ['intro', 'avoid', 'ok', 'ask', 'thanks']);
  assert.deepEqual(ja(c, 'intro'), ['私たちはベジタリアンです。肉・魚・魚介類は食べられません。']);
  assert.equal(ja(c, 'avoid').length, 4);
  assert.equal(ja(c, 'avoid')[3], 'ナッツ類も口にできません。');
  assert.equal(en(c, 'avoid')[3], 'We also cannot have nuts.');
  assert.equal(ja(c, 'ok')[0], '野菜・豆腐・ご飯・麺・卵・乳製品は大丈夫です。');
  assert.equal(ja(c, 'ok')[1], '昆布や椎茸のだしなら大丈夫です。');
  assert.deepEqual(en(c, 'ask'), ['Does this dish contain dashi or fish?', 'Could you make it without fish stock?', 'Which dishes have no meat and no fish?']);
  assert.deepEqual(c.english_only, []);
});

test('a vegan party: no eggs or dairy among the fine items, the vegan question, eggs not repeated as an extra', async () => {
  const c = await cardFor('vegan_solo');
  assert.equal(c.diet, 'vegan');
  assert.equal(c.party, 1);
  assert.match(ja(c, 'intro')[0], /^私はヴィーガン/);
  assert.equal(ja(c, 'avoid').length, 3, 'eggs are covered by vegan: no "also" line');
  assert.equal(ja(c, 'ok')[0], '野菜・豆腐・ご飯・麺は大丈夫です。');
  assert.doesNotMatch(en(c, 'ok')[0], /eggs|dairy/);
  assert.equal(ja(c, 'ask')[2], '肉・魚・卵・乳製品を使っていない料理はありますか？');
});

test('a shellfish-only party: "we cannot have the following", one line per limit, the contains question, no ok and no which', async () => {
  const c = await cardFor('shellfish_trio');
  assert.equal(c.diet, null);
  assert.equal(c.party, 3);
  assert.deepEqual(c.sections.map((s) => s.id), ['intro', 'avoid', 'ask', 'thanks']);
  assert.deepEqual(ja(c, 'intro'), ['私たちは次のものを口にできません。']);
  assert.deepEqual(ja(c, 'avoid'), ['エビ・カニ・貝類']);
  assert.deepEqual(ja(c, 'ask'), ['この料理にエビ・カニ・貝類は入っていますか？'], 'no ask.without: shellfish is not fish or seafood');
  const { vegCard } = await V();
  const sea = vegCard({ party: { dietary: ['seafood', 'shellfish', 'pork', 'beef', 'alcohol'], diet: null, size: 1 }, country: 'JP', trip: 'x' });
  assert.deepEqual(en(sea, 'avoid'), ['Pork', 'Beef', 'Seafood', 'Alcohol, including cooking sake and mirin'], 'seafood covers shellfish; table order');
  assert.deepEqual(en(sea, 'ask'), ['Does this dish contain pork, beef, seafood?', 'Could you make it without fish stock?'], 'at most three items; ask.without when seafood is a limit');
  assert.equal(vegCard({ party: { dietary: [], diet: null, size: 2 }, country: 'JP', trip: 'x' }), null, 'nothing to say → null');
});

test('a destination with no phrase table: English only, local null everywhere, the unknown limit in english_only', async () => {
  const { validateVegCardPayload } = await V();
  const c = await cardFor('no_table');
  assert.deepEqual(validateVegCardPayload(c), []);
  assert.equal(c.country, 'FR');
  assert.equal(c.lang, null);
  assert.ok(c.sections.every((s) => s.lines.every((l) => l.local === null && l.en.length > 0)));
  assert.deepEqual(c.english_only, ['lupin beans']);
  assert.equal(en(c, 'intro')[0], 'I am vegetarian. I do not eat meat, fish or seafood.');
  const { vegCard } = await V();
  assert.equal(vegCard({ party: { diet: 'vegan', size: 1 }, country: null, trip: 'x' }).country, null);
  assert.equal(vegCard({ party: { diet: 'vegan', size: 1 }, country: 'jp', trip: 'x' }).lang, 'ja', 'the country code is upper-cased');
  assert.equal(vegCard({ party: { diet: 'vegan', size: 1 }, country: 'Japan', trip: 'x' }).country, null, 'not a two-letter code → null');
});

test('the fingerprint ignores order and case and changes when a value is added', async () => {
  const { vegCard, vegCardFp, fnv1a } = await V();
  assert.equal(fnv1a(''), '811c9dc5');
  assert.equal(fnv1a('a'), 'e40c292c', 'FNV-1a 32-bit');
  const fp = (dietary, size = 2) => vegCard({ party: { dietary, size }, country: 'JP', trip: 'x' }).fp;
  const a = fp(['meat and fish', 'nuts', 'gluten', 'Lupin']);
  assert.match(a, /^vcf1:[0-9a-f]{8}$/);
  assert.equal(fp(['LUPIN', 'gluten', 'nuts', 'meat and fish']), a, 'order and case');
  assert.notEqual(fp(['meat and fish', 'nuts', 'gluten', 'Lupin', 'alcohol']), a, 'one more limit');
  assert.notEqual(fp(['meat and fish', 'nuts', 'gluten', 'Lupin'], 1), a, '"I" and "we" differ');
  assert.equal(fp(['meat and fish', 'nuts', 'gluten', 'Lupin'], 5), a, 'two and five are both "we"');
  const want = 'vcf1:' + fnv1a('v1|ja|vegetarian|many|gluten,nuts|lupin');
  assert.equal(a, want, 'the C14 string: extra avoid keys sorted, english_only lower-cased and sorted');
  assert.equal(vegCardFp({ lang: null, diet: null, size: 1, avoid: ['b', 'a'], english_only: ['Y', 'x'] }), 'vcf1:' + fnv1a('v1|-|-|one|a,b|x,y'));
});

test('escaping: chat and printable renderings escape every string; the section follows the brochure page markup', async () => {
  const { vegCard, vegCardTelegram, vegCardHtml } = await V();
  const c = vegCard({ party: { dietary: ['meat and fish', '<script>alert(1)</script>', 'a & b'], size: 1 }, country: 'JP', trip: 'x' });
  const t = vegCardTelegram(c);
  assert.match(t, /^<b>🥗 Veg card — show this to the staff<\/b>/);
  assert.match(t, /<b>私はベジタリアンです。肉・魚・魚介類は食べられません。<\/b>\n<i>I am vegetarian\. I do not eat meat, fish or seafood\.<\/i>/);
  assert.ok(t.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && t.includes('a &amp; b'));
  assert.doesNotMatch(t, /<script/);
  assert.match(t, /translation app/);
  const h = vegCardHtml(c);
  assert.match(h, /^<section class="sec sec-vegcard" data-pg="section" data-folio="Veg card">/);
  assert.ok((h.match(/data-pg="block"/g) || []).length >= c.sections.length + 1);
  assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.doesNotMatch(h, /<script/);
  assert.match(h, /<span class="vc-local" lang="ja">私はベジタリアンです。/);
  assert.match(h, /<style>/);
  assert.doesNotMatch(vegCardHtml(c, { css: false }), /<style>/);
  const plain = vegCard({ party: { diet: 'vegan', size: 1 }, country: 'NZ', trip: 'x' });
  assert.match(vegCardTelegram(plain), /English only/);
  assert.doesNotMatch(vegCardHtml(plain), /class="vc-local"/);
});

test('bounds: party clamped to 1–12, english_only ≤ 12 × 60, every line ≤ 200, the fullest card stays under 8 000 chars', async () => {
  const { vegCard, validateVegCardPayload, PHRASES } = await V();
  assert.equal(vegCard({ party: { diet: 'vegan', size: 40 }, country: 'JP', trip: 'x' }).party, 12);
  assert.equal(vegCard({ party: { diet: 'vegan', size: 0 }, country: 'JP', trip: 'x' }).party, 1);
  assert.equal(vegCard({ party: { diet: 'vegan', size: 'x' }, country: 'JP', trip: 'x' }).party, 1);
  const words = Array.from({ length: 20 }, (_, i) => `invented-food-${i}-`.padEnd(70, 'z'));
  const all = Object.values(PHRASES.items).flatMap((it) => it.aliases);
  for (const diet of [null, 'vegetarian']) {
    const c = vegCard({ party: { dietary: diet ? ['vegetarian', ...all.filter((a) => a !== 'meat'), ...words] : [...all.filter((a) => !/meat|fish|seafood/.test(a)), ...words], size: 12 }, country: 'JP', trip: 'x' });
    assert.deepEqual(validateVegCardPayload(c), [], String(diet));
    assert.equal(c.english_only.length, 12);
    assert.ok(c.english_only.every((s) => s.length === 60));
    assert.ok(c.sections.every((s) => s.lines.every((l) => l.en.length <= 200 && l.local.length <= 200)));
    assert.ok(JSON.stringify(c).length < 8000);
  }
});

test('the pack validator refuses what C14 refuses, and schemas/index.mjs knows veg_card', async () => {
  const [{ validateVegCardPayload }, s] = await Promise.all([V(), S()]);
  const good = await cardFor('vegetarian_pair_nuts');
  assert.equal(s.validatePayload('veg_card', good).ok, true);
  assert.equal(s.validatePayload('veg_card', good).kind, 'veg-card');
  const refuse = (mutate, re) => {
    const p = clone(good);
    mutate(p);
    const errs = validateVegCardPayload(p);
    assert.ok(errs.some((e) => re.test(e)), `${re}: ${errs.join('; ')}`);
    assert.equal(s.validatePayload('veg_card', p).ok, false);
  };
  refuse((p) => { p.sections.reverse(); }, /out of order/);
  refuse((p) => { p.sections.push(clone(p.sections[0])); }, /appears twice/);
  refuse((p) => { p.lang = null; }, /must be null when lang is null/);
  refuse((p) => { p.sections[0].lines[0].local = null; }, /must be a string when lang is set/);
  refuse((p) => { p.fp = 'vcf1:ABCDEF12'; }, /^\/fp/);
  refuse((p) => { p.party = 13; }, /^\/party/);
  refuse((p) => { p.lang = 'fr'; }, /^\/lang/);
  refuse((p) => { p.diet = 'pescatarian'; }, /^\/diet/);
  refuse((p) => { p.country = 'jp'; }, /^\/country/);
  refuse((p) => { p.sections[0].id = 'menu'; }, /^\/sections\/0\/id/);
  refuse((p) => { p.sections[0].lines[0].en = 'e'.repeat(201); }, /^\/sections\/0\/lines\/0\/en/);
  refuse((p) => { p.sections[0].lines[0].extra = 1; }, /^\/sections\/0\/lines\/0/);
  refuse((p) => { p.sections = []; }, /^\/sections/);
  refuse((p) => { p.english_only = ['']; }, /^\/english_only\/0/);
  refuse((p) => { p.kind = 'veg_card'; }, /kind/);
  refuse((p) => { delete p.trip; }, /trip/);
  refuse((p) => { p.sections = Array.from({ length: 5 }, (_, i) => ({ id: ['intro', 'avoid', 'ok', 'ask', 'thanks'][i], lines: Array.from({ length: 12 }, () => ({ local: '漢'.repeat(150), en: 'e'.repeat(150) })) })); }, /under 8000/);
});

test('per person: a vegetarian owner is "I", the companion\'s limit is "my companion", asked about in every dish', async () => {
  const { validateVegCardPayload, vegCardTelegram, vegCardHtml } = await V();
  const c = await cardFor('vegetarian_owner_eggs_companion', { members: true });
  assert.deepEqual(validateVegCardPayload(c), []);
  assert.equal(c.diet, 'vegetarian');
  assert.equal(c.party, 2);
  assert.deepEqual(ja(c, 'intro'), ['私はベジタリアンです。肉・魚・魚介類は食べられません。']);
  assert.deepEqual(en(c, 'intro'), ['I am vegetarian. I do not eat meat, fish or seafood.']);
  assert.equal(ja(c, 'avoid').length, 4);
  assert.equal(ja(c, 'avoid')[3], '連れは卵を口にできません。');
  assert.equal(en(c, 'avoid')[3], 'My companion cannot have eggs.');
  assert.ok(c.sections.every((s) => s.lines.every((l) => !l.local.startsWith('私たち') && !/\bwe\b/i.test(l.en))), 'no line speaks for both');
  assert.equal(ja(c, 'ok')[0], '野菜・豆腐・ご飯・麺・乳製品は大丈夫です。', 'never looser for anyone: no eggs among the fine items');
  assert.deepEqual(en(c, 'ask'), ['Does this dish contain dashi or fish?', 'Could you make it without fish stock?', 'Which dishes have no meat and no fish?',
    'Does this dish contain eggs?']);
  assert.equal(ja(c, 'ask')[3], 'この料理に卵は入っていますか？');
  assert.match(vegCardTelegram(c), /<b>連れは卵を口にできません。<\/b>\n<i>My companion cannot have eggs\.<\/i>/);
  assert.match(vegCardHtml(c), /連れは卵/);
  const merged = await cardFor('vegetarian_owner_eggs_companion');
  assert.deepEqual(ja(merged, 'intro'), ['私たちはベジタリアンです。肉・魚・魚介類は食べられません。'], 'without members: one voice, as before');
  assert.equal(en(merged, 'avoid')[3], 'We also cannot have eggs.');
  assert.notEqual(c.fp, merged.fp, 'the per-person card is a new card');
  const nuts = await cardFor('vegetarian_pair_nuts', { members: true });
  assert.equal(ja(nuts, 'intro')[0], '私はベジタリアンです。肉・魚・魚介類は食べられません。');
  assert.equal(ja(nuts, 'avoid')[3], '連れはナッツ類を口にできません。');
  assert.equal(en(nuts, 'avoid')[3], 'My companion cannot have nuts.');
  assert.equal(en(nuts, 'ask')[3], 'Does this dish contain nuts?');
});

test('per person: a companion who keeps the diet opens; the owner\'s own limit is "I"; a diet everyone keeps is "we"', async () => {
  const { vegCard } = await V();
  const card = (members, size = members.length) => vegCard({ party: { size, members }, country: 'JP', trip: 'x' });
  const c = card([{ dietary: ['nuts'], diet: null }, { dietary: ['meat and fish'], diet: 'vegetarian' }]);
  assert.deepEqual(ja(c, 'intro'), ['連れはベジタリアンです。肉・魚・魚介類は食べられません。']);
  assert.deepEqual(en(c, 'intro'), ['My companion is vegetarian and does not eat meat, fish or seafood.']);
  assert.ok(ja(c, 'avoid').includes('私はナッツ類を口にできません。') && en(c, 'avoid').includes('I cannot have nuts.'));
  const both = card([{ dietary: ['meat and fish'], diet: 'vegetarian' }, { dietary: ['vegetarian', 'nuts'], diet: 'vegetarian' }]);
  assert.deepEqual(en(both, 'intro'), ['We are vegetarian. We do not eat meat, fish or seafood.'], 'both keep the diet: said once');
  assert.equal(en(both, 'avoid')[3], 'My companion also cannot have nuts.');
  assert.equal(ja(both, 'avoid')[3], '連れはナッツ類も口にできません。');
  const vegan = card([{ dietary: ['meat and fish'] }, { dietary: ['vegan'] }, { dietary: ['animal products'] }, { dietary: ['wheat'] }]);
  assert.equal(vegan.diet, 'vegan', 'the strictest diet holds for ok and the questions');
  assert.equal(en(vegan, 'intro')[0], 'I am vegetarian. I do not eat meat, fish or seafood.');
  assert.ok(en(vegan, 'avoid').includes('2 of my companions are vegan and do not eat meat, fish, seafood, eggs or dairy.'), 'two say the same: one line, plural');
  assert.ok(ja(vegan, 'avoid').includes('連れのうち2人はヴィーガン（完全菜食）です。肉・魚・魚介類・卵・乳製品は食べられません。'));
  assert.ok(en(vegan, 'avoid').includes('One of my companions cannot have wheat (gluten).'));
  assert.equal(ja(vegan, 'ok')[0], '野菜・豆腐・ご飯は大丈夫です。', 'no eggs or dairy (vegan), no noodles (gluten)');
  assert.deepEqual(en(vegan, 'ask').slice(2), ['Which dishes have no meat, fish, eggs or dairy?', 'Does this dish contain wheat (gluten)?']);
  const all = card([{ dietary: [] }, { dietary: ['nuts'] }, { dietary: ['nuts'] }]);
  assert.deepEqual(en(all, 'intro'), ['All my companions cannot have nuts.']);
  assert.deepEqual(ja(all, 'intro'), ['連れは全員ナッツ類を口にできません。']);
  const fish = card([{ dietary: ['meat and fish'] }, { dietary: ['fish', 'nuts'] }]);
  assert.deepEqual(en(fish, 'ask').slice(3), ['Does this dish contain nuts?'], 'a limit the diet\'s questions already ask is not asked again');
  assert.equal(en(fish, 'avoid')[3], 'My companion cannot have fish, nuts.');
});

test('one voice when it says the same: identical members are the old card byte for byte; only the owner with limits is "I"', async () => {
  const [{ vegCard, vegCardFp }, { partyDiet }] = await Promise.all([V(), P()]);
  const legacy = (members, size = members.length) => vegCard({ party: { ...partyDiet(members), size }, country: 'JP', trip: 'x' });
  const card = (members, size = members.length) => vegCard({ party: { ...partyDiet(members), size, members }, country: 'JP', trip: 'x' });
  const same = [{ dietary: ['meat and fish'], diet: 'vegetarian' }, { dietary: ['vegetarian'], diet: 'vegetarian' }];
  assert.deepEqual(card(same), legacy(same), 'everyone the same: "we", same card, same fingerprint');
  assert.deepEqual(card(FIX.vegan_solo.members), legacy(FIX.vegan_solo.members), 'a party of one is unchanged');
  const three = Array.from({ length: 3 }, () => ({ dietary: ['meat and fish', 'alcohol'], diet: 'vegetarian' }));
  assert.deepEqual(card(three), legacy(three));
  assert.equal(en(card(three), 'avoid')[3], 'We also cannot have alcohol, including cooking sake and mirin.', 'drunk, not eaten: "cannot have"');
  assert.equal(ja(card(three), 'avoid')[3], 'アルコール（料理酒・みりんを含む）も口にできません。');
  const trio = await cardFor('shellfish_trio', { members: true });
  assert.equal(trio.party, 3);
  assert.deepEqual(en(trio, 'intro'), ['I cannot have the following.'], 'the companions have no limit: the owner speaks alone');
  assert.deepEqual(en(trio, 'avoid'), ['Shellfish (shrimp, crab, clams)']);
  assert.equal(trio.fp, vegCardFp({ lang: 'ja', diet: null, size: 1, avoid: ['shellfish'], english_only: [] }));
  const lone = card([{ dietary: ['meat and fish'], diet: 'vegetarian' }], 2);
  assert.equal(lone.party, 2, 'a companion with no profile yet still counts');
  assert.deepEqual(en(lone, 'intro'), ['I am vegetarian. I do not eat meat, fish or seafood.'], 'and is not spoken for');
  assert.equal(card([{}, { dietary: [] }]), null, 'nobody has a limit: nothing to say');
  assert.equal(vegCard({ party: { size: 3, members: [null, { dietary: ['nuts'] }] }, country: 'JP', trip: 'x' }).party, 3);
});

test('per person: words with no phrase say whose they are; too long to say per person falls back to the merged card', async () => {
  const [{ vegCard, validateVegCardPayload }, { partyDiet }] = await Promise.all([V(), P()]);
  const c = vegCard({ party: { size: 2, members: [{ dietary: ['meat and fish', 'lupin beans'] }, { dietary: ['durian', 'x'.repeat(60)] }] }, country: 'FR', trip: 'x' });
  assert.deepEqual(validateVegCardPayload(c), []);
  assert.deepEqual(c.english_only, ['Me: lupin beans', 'My companion: durian', `My companion: ${'x'.repeat(46)}`], 'labelled, clipped to 60');
  assert.equal(en(c, 'avoid')[3], 'My companion cannot have the following.');
  const items = ['pork', 'beef', 'chicken', 'fish', 'seafood', 'shellfish', 'eggs', 'dairy', 'nuts', 'gluten', 'alcohol'];
  const twelve = [{ dietary: ['meat and fish'], diet: 'vegetarian' }, ...items.map((v) => ({ dietary: [v], diet: null }))];
  const merged = vegCard({ party: { ...partyDiet(twelve), size: 12 }, country: 'JP', trip: 'x' });
  assert.deepEqual(vegCard({ party: { ...partyDiet(twelve), size: 12, members: twelve }, country: 'JP', trip: 'x' }), merged,
    'eleven different limits would need more than 12 lines: the merged card, stricter for each, never looser');
  assert.equal(merged.sections.find((s) => s.id === 'intro').lines[0].en, 'We are vegetarian. We do not eat meat, fish or seafood.');
  const thirteen = [...twelve, { dietary: ['nuts'] }];
  const over = vegCard({ party: { size: 13, members: thirteen }, country: 'JP', trip: 'x' });
  assert.equal(over.party, 12);
  assert.deepEqual(over, vegCard({ party: { ...partyDiet(thirteen), size: 12 }, country: 'JP', trip: 'x' }), 'more than 12 travellers: merged');
});

test('the per-person fingerprint adds the groups, sorted: who has a limit changes it, the companions\' order does not', async () => {
  const { vegCard, vegCardFp, fnv1a } = await V();
  const fp = (members) => vegCard({ party: { size: members.length, members }, country: 'JP', trip: 'x' }).fp;
  const veg = { dietary: ['meat and fish'], diet: 'vegetarian' };
  const a = fp([veg, { dietary: ['eggs'] }]);
  assert.equal(a, 'vcf1:' + fnv1a('v1|ja|vegetarian|many|eggs||m:c1/1:-:eggs:;o:vegetarian::'));
  assert.equal(vegCardFp({ lang: 'ja', diet: 'vegetarian', size: 2, avoid: ['eggs'], members: ['o:vegetarian::', 'c1/1:-:eggs:'] }), a);
  assert.notEqual(fp([{ dietary: ['meat and fish', 'eggs'] }, veg]), a, 'the eggs moved to the owner');
  assert.notEqual(fp([{ dietary: ['eggs'] }, veg]), a, 'the diet moved to the companion');
  const ab = [veg, { dietary: ['nuts'] }, { dietary: ['eggs'] }];
  assert.equal(fp(ab), fp([ab[0], ab[2], ab[1]]), 'the same people in another order');
  assert.equal(vegCardFp({ lang: 'ja', diet: 'vegetarian', size: 2, avoid: ['nuts'] }), vegCardFp({ lang: 'ja', diet: 'vegetarian', size: 2, avoid: ['nuts'], members: [] }),
    'no members: the C14 string as it was');
});

// Developed by: LightAISolutions
