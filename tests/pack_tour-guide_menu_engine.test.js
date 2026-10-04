'use strict';
// TG-PHASE-16 WP-16b (Contract C16): the Menu check engine — the owner's words, menuFits, menuNote, menuFact through the
// facts pack, menuCaveat against the planner's real dinnerMenu, menuCounts / menuCountsFrom, menuPayload's order and cap,
// and the pack validator's own rules. Invented restaurants, dishes and prices only; no network, no clock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'packs', 'tour-guide', 'menu');
const FIX = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures', 'menu-sample.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures', 'menu-parse-cases.json'), 'utf8'));
const J = (v) => JSON.parse(JSON.stringify(v));
const menu = () => import('../packs/tour-guide/menu/index.mjs');
const dish = (name, course, fits, over = {}) => ({ name, course, fits, ...(fits === 'ask' ? { ask: 'without the broth?' } : {}), ...over });

test('parseMenuText: every shared case; today must be a date', async () => {
  const { parseMenuText, PLACE_MAX } = await menu();
  assert.equal(PLACE_MAX, 80);
  for (const c of CASES.cases) assert.deepEqual(parseMenuText(c.text, { today: CASES.today }), c.want, JSON.stringify(c.text));
  assert.ok(CASES.cases.some((c) => c.want.ok && c.want.place.length === 80) && CASES.cases.some((c) => c.want.why === 'too_long'), 'the 80-character edge is covered');
  assert.throws(() => parseMenuText('/menu Brindle Lantern', { today: 'soon' }), /today must be a calendar date/);
});

test('menuFits: nothing read, desserts only, a set or main that fits, one to ask about, two small plates, one is not enough', async () => {
  const { menuFits, MENU } = await menu();
  assert.equal(MENU.DISHES, 12);
  assert.equal(MENU.PARTLY_MIN_SMALL, 2);
  assert.equal(menuFits([dish('Oat tart', 'dessert', 'yes')], { read: false }), 'unknown', 'read is false');
  assert.equal(menuFits([], { read: true, others: 0 }), 'unknown', 'no dishes and no others');
  assert.equal(menuFits([], { read: true }), 'unknown');
  assert.equal(menuFits([], { read: true, others: 8 }), 'no', 'a menu was read and nothing fits');
  assert.equal(menuFits([dish('Oat tart', 'dessert', 'yes'), dish('Pear cordial', 'drink', 'yes')], { read: true, others: 5 }), 'no', 'desserts and drinks alone never fit');
  assert.equal(menuFits([dish('Garden set', 'set', 'yes')]), 'yes');
  assert.equal(menuFits([dish('Barley risotto', 'main', 'yes'), dish('Noodle broth', 'main', 'ask')]), 'yes');
  assert.equal(menuFits([dish('Garden set', 'set', 'ask')]), 'partly', 'a set to ask about');
  assert.equal(menuFits([dish('Charred leeks', 'side', 'yes'), dish('Radish plate', 'starter', 'yes')]), 'partly', 'two small plates');
  assert.equal(menuFits([dish('Charred leeks', 'side', 'yes'), dish('Radish plate', 'starter', 'ask')]), 'no', 'one small plate that fits is not a dinner');
  assert.equal(menuFits([dish('Charred leeks', 'side', 'yes'), dish('Oat tart', 'dessert', 'yes')]), 'no');
});

test('menuNote: both halves, one half, nothing fits, nothing found, and the cut at a word', async () => {
  const { menuNote, cutWords } = await menu();
  const d = [dish('Garden set', 'set', 'yes'), dish('Noodle broth', 'main', 'ask'), dish('Radish plate', 'starter', 'yes')];
  assert.equal(menuNote({ fits: 'yes', dishes: d, diet: 'vegetarian' }), 'Fits: Garden set, Radish plate; ask: Noodle broth');
  assert.equal(menuNote({ fits: 'partly', dishes: [d[1]], diet: 'vegetarian' }), 'ask: Noodle broth', 'an empty half is left out');
  assert.equal(menuNote({ fits: 'yes', dishes: [d[0]] }), 'Fits: Garden set');
  assert.equal(menuNote({ fits: 'no', dishes: [], diet: 'vegetarian, no fish stock' }), 'Nothing on the menu fits vegetarian, no fish stock');
  assert.equal(menuNote({ fits: 'no', dishes: [] }), 'Nothing on the menu fits your diet');
  assert.equal(menuNote({ fits: 'unknown', dishes: d, diet: 'vegetarian' }), 'No menu found to check');
  const many = Array.from({ length: 12 }, (_, i) => dish('Seasonal plate number ' + (i + 1), 'main', 'yes'));
  const note = menuNote({ fits: 'yes', dishes: many });
  assert.ok(note.length <= 160 && note.endsWith('…'), note);
  assert.ok(/(\d|plate)…$/.test(note) && !/,…$/.test(note), 'cut at a word, without the comma: ' + note);
  assert.equal(cutWords('alpha beta gamma', 11), 'alpha beta…');
  assert.equal(cutWords('alpha beta', 10), 'alpha beta');
  assert.equal(cutWords('abcdefghijkl', 6), 'abcde…', 'one long word is cut hard');
});

test('menuFact: { checked, fits, note }, a valid facts.menu through the facts pack\'s normalizeFacts', async () => {
  const { menuFact } = await menu();
  const facts = await import('../packs/tour-guide/facts/index.mjs');
  for (const p of FIX.valid) {
    const fact = menuFact(p);
    assert.deepEqual(Object.keys(fact), ['checked', 'fits', 'note']);
    assert.deepEqual(fact, { checked: p.checked, fits: p.fits, note: p.note });
    const r = facts.normalizeFacts({ checked: p.checked, sources: [{ title: 'Own site', url: 'https://example.org/', accessed: p.checked }], menu: fact });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.deepEqual(r.facts.menu, fact);
  }
});

test('menuCaveat: the real dinnerMenu caveats in the planner\'s "name · caveat" form and the digest\'s capitalised form; the non-matches', async () => {
  const { menuCaveat, CAVEAT_RE } = await menu();
  const { dinnerMenu } = await import('../packs/tour-guide/planner/index.mjs');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const cases = [
    [dinnerMenu(null, { diet: 'vegetarian' }).caveat, 'unchecked'],
    [dinnerMenu({ menu_fits: null, menu_checked: null }, {}).caveat, 'unchecked'],
    [dinnerMenu({ menu_fits: 'yes', menu_checked: null }, { today: '2027-05-13', diet: 'vegan' }).caveat, 'unchecked'],
    [dinnerMenu({ menu_fits: 'yes', menu_checked: '2027-03-01' }, { today: '2027-05-13' }).caveat, 'old'],
    [dinnerMenu({ menu_fits: 'partly', menu_checked: '2027-03-01' }, { today: '2027-05-13', diet: 'vegetarian' }).caveat, 'old']
  ];
  assert.deepEqual(cases.map((c) => c[0]), ['menu not checked for vegetarian', 'menu not checked for your diet', 'menu not checked for vegan',
    'menu last checked 2027-03-01', 'menu last checked 2027-03-01'], 'the planner\'s own words');
  for (const [caveat, want] of cases) {
    assert.equal(menuCaveat('Salt Loft · ' + caveat), want, 'planner form: ' + caveat);
    assert.equal(menuCaveat(cap(caveat)), want, 'digest form: ' + caveat);
    assert.equal(menuCaveat('Booked for 2 · ' + cap(caveat)), want, 'after " · " in the digest form');
  }
  for (const no of ['The menu partly fits your diet', 'Salt Loft · the menu partly fits your diet', 'Salt Loft', 'Booked for 2 at 19:00.', '', null,
    'A menu not checked for anyone', 'Salt Loft · menu', dinnerMenu({ menu_fits: 'yes', menu_checked: '2027-05-01' }, { today: '2027-05-13' }).caveat]) {
    assert.equal(menuCaveat(no), null, JSON.stringify(no));
  }
  assert.equal(CAVEAT_RE.flags, 'i');
});

test('menuCounts at 30 and 31 days, a check after the dinner, and menuCountsFrom; MAX_AGE_DAYS is the facts pack\'s', async () => {
  const { menuCounts, menuCountsFrom, MAX_AGE_DAYS } = await menu();
  const facts = await import('../packs/tour-guide/facts/index.mjs');
  const { dinnerMenu } = await import('../packs/tour-guide/planner/index.mjs');
  assert.equal(MAX_AGE_DAYS, facts.MENU_MAX_AGE_DAYS);
  assert.equal(menuCounts('2027-04-13', '2027-05-13'), true, '30 days');
  assert.equal(menuCounts('2027-04-12', '2027-05-13'), false, '31 days');
  assert.equal(menuCounts('2027-05-20', '2027-05-13'), true, 'a check made after the dinner\'s date');
  assert.equal(menuCounts('', '2027-05-13'), false);
  assert.equal(menuCountsFrom('2027-05-13'), '2027-04-13');
  assert.equal(menuCountsFrom('2027-03-02'), '2027-01-31');
  assert.throws(() => menuCountsFrom('2027-02-30'), /calendar date/);
  // The planner counts the same way: a check counts exactly when dinnerMenu gives no caveat.
  for (const checked of ['2027-04-12', '2027-04-13', '2027-05-13']) {
    assert.equal(menuCounts(checked, '2027-05-13'), dinnerMenu({ menu_fits: 'yes', menu_checked: checked }, { today: '2027-05-13' }).caveat === null, checked);
  }
});

test('menuPayload: fixture valid[0..3] rebuilt; order by course then yes before ask; the cap adds to others; a dish that does not fit is counted', async () => {
  const { menuPayload, menuId } = await menu();
  const rebuild = (p) => menuPayload({ trip: p.trip, createdOn: p.created_on, date: p.date, place: p.place, checked: p.checked, read: p.fits !== 'unknown',
    diet: p.diet, dishes: shuffle(p.dishes), others: p.others || 0, sources: p.sources });
  // Courses reversed, ask dishes first; dishes of the same course and fits keep their menu order.
  const shuffle = (ds) => [...ds].sort((a, b) => (COURSE_RANK[b.course] - COURSE_RANK[a.course]) || ((a.fits === 'ask' ? 0 : 1) - (b.fits === 'ask' ? 0 : 1)));
  const COURSE_RANK = { set: 0, main: 1, starter: 2, side: 3, dessert: 4, drink: 5 };
  for (const p of FIX.valid.slice(0, 4)) assert.deepEqual(rebuild(p), p, p.id);
  assert.equal(menuId('2027-05-01', 'Brindle Lantern!'), 'mn-20270501-brindle-lantern');
  assert.equal(menuId('2027-05-01', 'x'.repeat(60)), 'mn-20270501-' + 'x'.repeat(40));
  assert.equal(menuId('2027-05-01', '--'), 'mn-20270501-place');
  assert.throws(() => menuId('2027-5-1', 'a'), /createdOn/);

  const courses = ['drink', 'dessert', 'side', 'starter', 'main', 'set'];
  const dishes = [];
  courses.forEach((c) => { dishes.push(dish(c + ' to ask', c, 'ask')); dishes.push(dish(c + ' one', c, 'yes')); dishes.push(dish(c + ' two', c, 'yes')); });
  dishes.push(dish('Grilled trout', 'main', 'no'));
  const p = menuPayload({ trip: 'quillmere-2027', createdOn: '2027-05-01', place: { name: 'Long Menu', slug: 'long-menu' }, checked: '2027-05-01',
    diet: 'vegetarian', dishes, others: 4, sources: [{ title: 'Long Menu', url: 'https://long-menu.example/' }] });
  assert.deepEqual(p.dishes.map((d) => d.name), ['set one', 'set two', 'set to ask', 'main one', 'main two', 'main to ask', 'starter one', 'starter two',
    'starter to ask', 'side one', 'side two', 'side to ask']);
  assert.equal(p.others, 4 + 1 + 6, 'the given others, the dish that does not fit, and the six beyond twelve');
  assert.equal(p.fits, 'yes');
  assert.ok(!p.dishes.some((d) => d.fits === 'yes' && 'ask' in d) && p.dishes.filter((d) => d.fits === 'ask').every((d) => d.ask));
  assert.equal(menuPayload({ trip: null, createdOn: '2027-05-01', place: { name: 'Big', slug: 'big' }, checked: '2027-05-01', diet: 'vegan', others: 250,
    dishes: [], sources: [{ title: 'Big', url: 'https://big.example/' }] }).others, 200, 'others is capped');
  assert.throws(() => menuPayload({ trip: null, createdOn: '2027-05-01', place: { name: 'No Source', slug: 'no-source' }, checked: '2027-05-01',
    diet: 'vegan', dishes: [dish('Bean stew', 'main', 'yes')], sources: [] }), /sources: at least 1 entry unless fits is unknown/);
  assert.throws(() => menuPayload({ trip: null, createdOn: '2027-05-01', place: { name: 'Bad', slug: 'Bad Slug' }, checked: '2027-05-01', diet: 'vegan', read: false }),
    /place\.slug has the wrong format/);
});

test('validateMenuPayload and checkMenu: the ask rule, the sources rule, a Google field, an oversize payload, too many dishes', async () => {
  const { validateMenuPayload, checkMenu, PAYLOAD_MAX } = await menu();
  assert.equal(PAYLOAD_MAX, 12000);
  const base = () => J(FIX.valid[0]);
  let p = base();
  p.dishes[2] = { name: 'Mountain noodle broth', course: 'main', fits: 'ask' };
  assert.deepEqual(validateMenuPayload(p), ['dishes[2].ask required when fits is ask']);
  p = base(); p.dishes[0].ask = 'is it vegetarian?';
  assert.deepEqual(validateMenuPayload(p), ['dishes[0].ask only when fits is ask']);
  p = base(); p.sources = [];
  assert.deepEqual(validateMenuPayload(p), ['sources: at least 1 entry unless fits is unknown']);
  p = J(FIX.valid[1]);
  assert.deepEqual(validateMenuPayload(p), [], 'unknown needs no source');
  p = base(); p.place.location = { lat: 1, lng: 2 }; p.dishes[1].rating = 4.5;
  const errs = validateMenuPayload(p);
  assert.ok(errs.includes('place.location: Google field refused (own data only)'), errs.join('\n'));
  assert.ok(errs.includes('dishes[1].rating: Google field refused (own data only)'), errs.join('\n'));
  p = base(); p.dishes = Array.from({ length: 12 }, (_, i) => ({ name: ('Dish ' + i + ' ').padEnd(80, 'n'), local: 'L'.repeat(80), course: 'main', fits: 'ask', ask: 'A'.repeat(120), price: 'P'.repeat(40) }));
  p.place.name = 'N'.repeat(120); p.diet = 'D'.repeat(80); p.note = 'O'.repeat(160);
  p.place.place_id = 'F'.repeat(300); p.place.local_name = 'B'.repeat(80); p.others = 200;
  p.sources = Array.from({ length: 3 }, (_, i) => ({ title: 'T'.repeat(120), url: ('https://long.example/' + i + '/').padEnd(2000, 'u') }));
  const n = JSON.stringify(p).length;
  assert.ok(n > PAYLOAD_MAX, String(n));
  assert.deepEqual(validateMenuPayload(p), ['payload is ' + n + ' chars (max ' + PAYLOAD_MAX + ')']);
  p = base(); p.dishes = Array.from({ length: 13 }, (_, i) => ({ name: 'Dish ' + i, course: 'main', fits: 'yes' }));
  assert.deepEqual(validateMenuPayload(p), ['dishes: at most 12 entries']);
  assert.deepEqual(checkMenu(base()), []);
  assert.deepEqual(checkMenu(J(FIX.invalid[15])), [{ path: '/', message: 'sources: at least 1 entry unless fits is unknown' }]);
});

// Developed by: LightAISolutions
