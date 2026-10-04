'use strict';
// packs/tour-guide/vegcard — the veg card engine (TG-PHASE-14 WP-14c, Contract C14): the phrase table covers every
// cannot-eat value the prefs kit can produce, the four composition cases, the fingerprint, escaping, bounds and the
// pack validator. Invented parties only (vegcard/vegcard-fixture-party.json).
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
async function cardFor(name) {
  const [{ vegCard }, { partyDiet }] = await Promise.all([V(), P()]);
  const f = FIX[name];
  return vegCard({ party: { ...partyDiet(f.members), size: f.members.length }, country: f.country, trip: f.trip });
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
  assert.equal(ja(c, 'avoid')[3], 'ナッツ類も食べられません。');
  assert.equal(en(c, 'avoid')[3], 'We also cannot eat nuts.');
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

test('a shellfish-only party: "we cannot eat the following", one line per limit, the contains question, no ok and no which', async () => {
  const c = await cardFor('shellfish_trio');
  assert.equal(c.diet, null);
  assert.equal(c.party, 3);
  assert.deepEqual(c.sections.map((s) => s.id), ['intro', 'avoid', 'ask', 'thanks']);
  assert.deepEqual(ja(c, 'intro'), ['私たちは次のものが食べられません。']);
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

// Developed by: LightAISolutions
