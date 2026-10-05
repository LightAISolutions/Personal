/**
 * Tour Guide — the veg card (TG-PHASE-14 WP-14c, Contract C14): the party's "what we cannot eat" card in the destination's
 * language and English, built once per trip from the party's diet and sent as a `veg_card` envelope.
 *   vegCard({ party, country, trip? }) → the C14 payload, or null when the party has nothing to say (no diet, no limit).
 *     party   partyDiet(...)'s result plus `size` ({ dietary: [...], diet, size }): one voice for everyone, "I" or "we".
 *             With `members` — [owner, ...companions], each dietOf()'s { dietary, diet } — each limit is said for the
 *             person who has it ("I", "my companion", "one of my companions"…); `members` then replaces dietary and diet.
 *     country ISO 3166-1 alpha-2 or null.
 *   vegCardFp({ lang, diet, size, avoid, english_only, members? }) → 'vcf1:xxxxxxxx' (only the engine computes it).
 *   LANG_BY_COUNTRY → { JP: 'ja' }; any other country has no phrase table yet (English only, `local` null).
 * Every line comes from vegcard-phrases.json; the only owner words on a card are the english_only values.
 * Pure: no network, no clock.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dietFromValues } from '../travellers/travellers-excerpt.mjs';

export const PHRASES = Object.freeze(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vegcard-phrases.json'), 'utf8')));
export const LANG_BY_COUNTRY = Object.freeze({ ...PHRASES.countries });
export const SECTION_IDS = Object.freeze(['intro', 'avoid', 'ok', 'ask', 'thanks']);
export const DIETS = Object.freeze(['vegetarian', 'vegan']);
export const LINE_MAX = 200;
export const ENGLISH_ONLY_MAX = 12;
export const ENGLISH_ONLY_LEN = 60;
export const PARTY_MAX = 12;
export const PAYLOAD_MAX = 8000;
const ITEM_KEYS = Object.keys(PHRASES.items);
const ALIAS = new Map(ITEM_KEYS.flatMap((k) => PHRASES.items[k].aliases.map((a) => [a, k])));
const DIET_VALUE = new Map(Object.entries(PHRASES.diet_values).flatMap(([d, vs]) => vs.map((v) => [v, d])));
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;   // the payload schemas' slug

/** FNV-1a 32-bit over the UTF-8 bytes → 8 lower-case hex digits (the same function as C13's lodging_fp). */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(String(str), 'utf8')) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const clip = (s, max) => (s.length > max ? s.slice(0, max).trimEnd() : s);
const many = (size) => size > 1;
const sizeOf = (party) => Math.min(PARTY_MAX, Math.max(1, Math.trunc(Number(party && party.size)) || 1));

/**
 * classify(values) → { diet, avoid: [item keys in table order], english_only: [...] } for raw cannot-eat values. A
 * diet value ("meat and fish", "vegan"…) names a diet; an alias names an item; anything else is english_only
 * (trimmed, ≤ 60 chars, de-duplicated without regard to case, ≤ 12). `avoid` is every named item, before covering.
 */
export function classify(values) {
  const avoid = new Set(), eo = [], seen = new Set();
  let diet = null;
  for (const raw of Array.isArray(values) ? values : []) {
    const v = norm(raw).toLowerCase();
    if (!v) continue;
    if (DIET_VALUE.has(v)) { const d = DIET_VALUE.get(v); if (DIETS.indexOf(d) > DIETS.indexOf(diet)) diet = d; continue; }
    if (ALIAS.has(v)) { avoid.add(ALIAS.get(v)); continue; }
    const shown = clip(norm(raw), ENGLISH_ONLY_LEN);
    if (!seen.has(shown.toLowerCase()) && eo.length < ENGLISH_ONLY_MAX) { seen.add(shown.toLowerCase()); eo.push(shown); }
  }
  return { diet, avoid: ITEM_KEYS.filter((k) => avoid.has(k)), english_only: eo };
}

/** The items a diet or the other limits already say: vegan covers eggs and dairy, seafood covers shellfish… */
export function extraLimits(diet, avoid) {
  const covered = new Set(diet ? PHRASES.covers[diet] : []);
  for (const k of avoid) for (const c of PHRASES.covers[k] || []) covered.add(c);
  return avoid.filter((k) => !covered.has(k));
}

/**
 * vegCardFp({ lang, diet, size, avoid, english_only, members }) → 'vcf1:' + FNV-1a of
 * 'v1|lang|diet|one-or-many|avoid,…|english_only,…', and for a per-person card '|m:' + its groups' signatures, sorted.
 */
export function vegCardFp({ lang = null, diet = null, size = 1, avoid = [], english_only = [], members = null } = {}) {
  const keys = [...new Set((avoid || []).map(String))].sort();
  const eo = [...new Set((english_only || []).map((s) => norm(s).toLowerCase()))].sort();
  const m = Array.isArray(members) && members.length ? `|m:${members.map(String).sort().join(';')}` : '';
  return 'vcf1:' + fnv1a(`v1|${lang || '-'}|${diet || '-'}|${many(size) ? 'many' : 'one'}|${keys.join(',')}|${eo.join(',')}${m}`);
}

const pick = (v, size) => (v && typeof v === 'object' ? v[many(size) ? 'many' : 'one'] : v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/**
 * One line of the table; `items` fills {items} (ja joined by ・, en by ", "), `who` fills {who} (a per-person line).
 * local null when the card has no language.
 */
function line(key, { lang, size, items = null, who = null }) {
  const t = PHRASES.lines[key];
  const fill = (s, side) => {
    const out = items ? s.replace('{items}', () => items.map((it) => it[side]).join(PHRASES.join[side])) : s;
    return who ? out.replace('{who}', () => who[side]) : out;
  };
  return { local: lang ? fill(pick(t[lang], size), lang) : null, en: cap(fill(pick(t.en, size), 'en')) };
}
/** Split items into runs whose filled line stays within LINE_MAX on both sides. */
function chunks(key, ctx, items) {
  const out = [];
  let run = [];
  const fits = (r) => { const l = line(key, { ...ctx, items: r }); return l.en.length <= LINE_MAX && (l.local === null || l.local.length <= LINE_MAX); };
  for (const it of items) {
    if (run.length && !fits([...run, it])) { out.push(run); run = []; }
    run.push(it);
  }
  if (run.length) out.push(run);
  return out.map((r) => line(key, { ...ctx, items: r }));
}

const strictest = (...diets) => diets.reduce((a, d) => (DIETS.indexOf(d) > DIETS.indexOf(a) ? d : a), null);
/** What one traveller (or the merged party) says: the strictest diet, the limits it does not cover, the words with no phrase. */
function resolve(values, diet) {
  const vs = Array.isArray(values) ? values : [];
  const k = classify(vs);
  const d = strictest(diet, k.diet, dietFromValues(vs.map((v) => norm(v).toLowerCase())));
  return { diet: d, extra: extraLimits(d, k.avoid), english_only: k.english_only };
}
const said = (r) => Boolean(r.diet || r.extra.length || r.english_only.length);
const sigOf = (r) => `${r.diet || '-'}:${r.extra.join(',')}:${r.english_only.map((s) => s.toLowerCase()).sort().join(',')}`;
/** Everyone's values in one: the merged party (partyDiet's union and strictest diet), stricter for each, never looser. */
const merged = (members) => resolve(members.flatMap((m) => (m && Array.isArray(m.dietary) ? m.dietary : [])), strictest(...members.map((m) => m && m.diet)));
const DIET_AVOID = ['avoid.stock', 'avoid.flakes', 'avoid.sauces'];
const SECTION_LINES_MAX = 12;
const itemOf = (key) => PHRASES.items[key];
/** ok: the base foods minus every extra limit (noodles too when gluten is one); eggs and dairy only on a vegetarian card. */
function okLines(lang, diet, extra) {
  const fine = ['vegetables', 'tofu', 'rice', 'noodles', ...(diet === 'vegetarian' ? ['eggs', 'dairy'] : [])]
    .filter((key) => !extra.includes(key) && !(key === 'noodles' && extra.includes('gluten')));
  return [...chunks('ok.base', { lang, size: 1 }, fine.map((key) => PHRASES.ok_items[key])), line('ok.stock', { lang, size: 1 })];
}
/** "Does this dish contain …?" for the first three items, one line (none without items). */
const containsLine = (ctx, items) => (items.length ? chunks('ask.contains', ctx, items.slice(0, 3).map(itemOf)).slice(0, 1) : []);

/** The shared card, one voice for everyone ("I" for one, "we" for more): the card as it always was. */
function composeShared({ lang, size, diet, extra }) {
  const ctx = { lang, size };
  const sections = [{ id: 'intro', lines: [line(diet ? `intro.${diet}` : 'intro.limits', ctx)] }];
  if (diet) {
    const avoid = DIET_AVOID.map((key) => line(key, ctx));
    if (extra.length) avoid.push(...chunks('avoid.also', ctx, extra.map(itemOf)));
    sections.push({ id: 'avoid', lines: avoid }, { id: 'ok', lines: okLines(lang, diet, extra) },
      { id: 'ask', lines: [line('ask.dashi', ctx), line('ask.without', ctx), line(`ask.which.${diet}`, ctx)] });
  } else {
    if (extra.length) sections.push({ id: 'avoid', lines: extra.map((key) => ({ local: lang ? itemOf(key)[lang] : null, en: cap(itemOf(key).en) })) });
    const ask = containsLine(ctx, extra);
    if (extra.includes('fish') || extra.includes('seafood')) ask.push(line('ask.without', ctx));
    if (ask.length) sections.push({ id: 'ask', lines: ask });
  }
  sections.push({ id: 'thanks', lines: [line('thanks', ctx)] });
  return sections;
}

/** whoOf(group, n) → { ja, en, label }: "I" for the owner; companions by how many of the n companions the group holds. */
function whoOf(g, n) {
  const W = PHRASES.who;
  const t = g.owner ? W.self : n === 1 ? W.companion : g.k === n ? W.companions_all : g.k === 1 ? W.companion_one_of : W.companions_some;
  const fill = (s) => s.replace('{k}', String(g.k));
  return { ja: fill(t.ja), en: fill(t.en), label: fill(t.label) };
}

/**
 * The per-person card. `people` = [owner, ...companions], each resolve()'s result (at least two say something, not all
 * the same). The owner speaks alone; companions who say the same thing speak as one group, in order of first
 * appearance; anyone with nothing to say is left out. The card's diet is the strictest: when everyone keeps it, "we" say
 * it once; else the lead (the owner when they keep a diet, else the first group with the strictest) opens and each other
 * group says its own. ok and the questions hold for everyone: the strictest diet's, minus every extra limit.
 * → { sections, diet, extra, english_only (each word labelled with who says it), words, sigs }.
 */
function composeEach({ lang, size, people }) {
  const n = size - 1;
  const groups = [];
  if (said(people[0])) groups.push({ owner: true, k: 1, r: people[0] });
  const bySig = new Map();
  for (const r of people.slice(1)) {
    if (!said(r)) continue;
    const s = sigOf(r);
    if (bySig.has(s)) bySig.get(s).k += 1;
    else { const g = { owner: false, k: 1, r }; bySig.set(s, g); groups.push(g); }
  }
  for (const g of groups) g.who = whoOf(g, n);
  const diet = strictest(...groups.map((g) => g.r.diet));
  const extra = ITEM_KEYS.filter((key) => groups.some((g) => g.r.extra.includes(key)));
  const shared = Boolean(diet) && people.every((r) => r.diet === diet);
  const lead = shared ? null : (diet && groups.find((g) => g.owner && g.r.diet)) || groups.find((g) => g.r.diet === diet);
  const ctx = { lang, size };
  const at = (g) => ({ lang, size: g.k, who: g.who });
  /** What a group says after the intro: its diet (unless said already), then its extra limits, or "the following". */
  const says = (g) => {
    const out = [];
    if (g.r.diet && !shared && g !== lead) out.push(line(`member.${g.r.diet}`, at(g)));
    if (g.r.extra.length) out.push(...chunks(g.r.diet ? 'member.also' : 'member.limits', at(g), g.r.extra.map(itemOf)));
    else if (!g.r.diet) out.push(line('member.following', at(g)));
    return out;
  };
  const sections = [];
  if (diet) {
    const intro = shared ? line(`intro.${diet}`, ctx) : lead.owner ? line(`intro.${lead.r.diet}`, { lang, size: 1 }) : line(`member.${lead.r.diet}`, at(lead));
    const order = lead ? [lead, ...groups.filter((g) => g !== lead)] : groups;
    const asked = extra.filter((key) => !PHRASES.covers[diet].includes(key));
    sections.push({ id: 'intro', lines: [intro] },
      { id: 'avoid', lines: [...DIET_AVOID.map((key) => line(key, ctx)), ...order.flatMap(says)] },
      { id: 'ok', lines: okLines(lang, diet, extra) },
      { id: 'ask', lines: [line('ask.dashi', ctx), line('ask.without', ctx), line(`ask.which.${diet}`, ctx), ...containsLine(ctx, asked)] });
  } else {
    sections.push({ id: 'intro', lines: says(lead) });
    const rest = groups.filter((g) => g !== lead).flatMap(says);
    if (rest.length) sections.push({ id: 'avoid', lines: rest });
    const ask = containsLine(ctx, extra);
    if (extra.includes('fish') || extra.includes('seafood')) ask.push(line('ask.without', ctx));
    if (ask.length) sections.push({ id: 'ask', lines: ask });
  }
  sections.push({ id: 'thanks', lines: [line('thanks', ctx)] });
  const english_only = [];
  const seen = new Set();
  for (const g of groups) {
    for (const v of g.r.english_only) {
      const s = clip(`${g.who.label}: ${v}`, ENGLISH_ONLY_LEN);
      if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); english_only.push(s); }
    }
  }
  return { sections, diet, extra, english_only, words: groups.flatMap((g) => g.r.english_only),
    sigs: groups.map((g) => `${g.owner ? 'o' : `c${g.k}/${n}`}:${sigOf(g.r)}`) };
}

/**
 * vegCard({ party, country, trip }) → { v: 1, trip?, country, lang, diet, party, fp, sections, english_only } or null.
 * Without `party.members`: one voice, the diet the strictest of party.diet and what the cannot-eat values say. With
 * members: one voice when everyone says the same ("we") or only the owner has limits ("I"); else the per-person card,
 * or the merged card when that would not fit C14's bounds. Sections, in order: intro, avoid, ok (cards with a diet),
 * ask, thanks — empty ones left out. helpers/decisions/WP-14c.md records every default.
 */
export function vegCard({ party = {}, country = null, trip } = {}) {
  const c = typeof country === 'string' && /^[A-Za-z]{2}$/.test(country.trim()) ? country.trim().toUpperCase() : null;
  const lang = c && LANG_BY_COUNTRY[c] ? LANG_BY_COUNTRY[c] : null;
  const p = party && typeof party === 'object' ? party : {};
  const members = Array.isArray(p.members) && p.members.length ? p.members : null;
  let size = sizeOf(p);
  let voice = size;   // a shared card's "I" (1) or "we"
  let one = null;     // a shared card's { diet, extra, english_only }
  let each = null;    // the per-person card
  if (!members) one = resolve(p.dietary, p.diet);
  else if (members.length > PARTY_MAX) { size = voice = PARTY_MAX; one = merged(members); }
  else {
    size = voice = Math.max(size, members.length);
    const people = Array.from({ length: size }, (_, i) => resolve(members[i] && members[i].dietary, members[i] && members[i].diet));
    if (!people.some(said)) return null;
    if (new Set(people.map(sigOf)).size === 1) one = people[0];                       // everyone says the same: "we"
    else if (!people.slice(1).some(said)) { one = people[0]; voice = 1; }            // only the owner has limits: "I"
    else each = composeEach({ lang, size, people });
  }
  const build = (sections, diet, fp, english_only) => {
    const out = { v: 1 };
    if (typeof trip === 'string' && SLUG_RE.test(trip)) out.trip = trip;
    return Object.assign(out, { country: c, lang, diet, party: size, fp, sections, english_only });
  };
  if (each) {
    const card = build(each.sections, each.diet, vegCardFp({ lang, diet: each.diet, size, avoid: each.extra, english_only: each.words, members: each.sigs }), each.english_only);
    if (each.english_only.length <= ENGLISH_ONLY_MAX && card.sections.every((s) => s.lines.length <= SECTION_LINES_MAX) && JSON.stringify(card).length < PAYLOAD_MAX) return card;
    one = merged(members);   // too long to say per person: the merged card
  }
  if (!said(one)) return null;
  return build(composeShared({ lang, size: voice, diet: one.diet, extra: one.extra }), one.diet,
    vegCardFp({ lang, diet: one.diet, size: voice, avoid: one.extra, english_only: one.english_only }), one.english_only);
}

// Developed by: LightAISolutions
