/**
 * Tour Guide — the veg card (TG-PHASE-14 WP-14c, Contract C14): the party's "what we cannot eat" card in the destination's
 * language and English, built once per trip from the party's diet and sent as a `veg_card` envelope.
 *   vegCard({ party, country, trip? }) → the C14 payload, or null when the party has nothing to say (no diet, no limit).
 *     party   partyDiet(...)'s result plus `size` ({ dietary: [...], diet, size }); country: ISO 3166-1 alpha-2 or null.
 *   vegCardFp({ lang, diet, size, avoid, english_only }) → 'vcf1:xxxxxxxx' (only the engine computes it).
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

/** vegCardFp({ lang, diet, size, avoid, english_only }) → 'vcf1:' + FNV-1a of 'v1|lang|diet|one-or-many|avoid,…|english_only,…'. */
export function vegCardFp({ lang = null, diet = null, size = 1, avoid = [], english_only = [] } = {}) {
  const keys = [...new Set((avoid || []).map(String))].sort();
  const eo = [...new Set((english_only || []).map((s) => norm(s).toLowerCase()))].sort();
  return 'vcf1:' + fnv1a(`v1|${lang || '-'}|${diet || '-'}|${many(size) ? 'many' : 'one'}|${keys.join(',')}|${eo.join(',')}`);
}

const pick = (v, size) => (v && typeof v === 'object' ? v[many(size) ? 'many' : 'one'] : v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** One line of the table; `items` fills {items} (ja joined by ・, en by ", "). local null when the card has no language. */
function line(key, { lang, size, items = null }) {
  const t = PHRASES.lines[key];
  const fill = (s, side) => (items ? s.replace('{items}', items.map((it) => it[side]).join(PHRASES.join[side])) : s);
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

/**
 * vegCard({ party, country, trip }) → { v: 1, trip?, country, lang, diet, party, fp, sections, english_only } or null.
 * The diet is the strictest of party.diet and what the cannot-eat values say. Sections, in order: intro, avoid, ok
 * (diet parties only), ask, thanks — empty ones left out. helpers/decisions/WP-14c.md records every default.
 */
export function vegCard({ party = {}, country = null, trip } = {}) {
  const size = sizeOf(party);
  const c = typeof country === 'string' && /^[A-Za-z]{2}$/.test(country.trim()) ? country.trim().toUpperCase() : null;
  const lang = c && LANG_BY_COUNTRY[c] ? LANG_BY_COUNTRY[c] : null;
  const values = Array.isArray(party.dietary) ? party.dietary : [];
  const k = classify(values);
  const lowered = values.map((v) => norm(v).toLowerCase());
  const diet = [party.diet, k.diet, dietFromValues(lowered)].reduce((a, d) => (DIETS.indexOf(d) > DIETS.indexOf(a) ? d : a), null);
  const extra = extraLimits(diet, k.avoid);
  if (!diet && !extra.length && !k.english_only.length) return null;
  const ctx = { lang, size };
  const item = (key) => PHRASES.items[key];
  const sections = [];
  sections.push({ id: 'intro', lines: [line(diet ? `intro.${diet}` : 'intro.limits', ctx)] });
  if (diet) {
    const avoid = ['avoid.stock', 'avoid.flakes', 'avoid.sauces'].map((key) => line(key, ctx));
    if (extra.length) avoid.push(...chunks('avoid.also', ctx, extra.map(item)));
    sections.push({ id: 'avoid', lines: avoid });
    const fine = ['vegetables', 'tofu', 'rice', 'noodles', ...(diet === 'vegetarian' ? ['eggs', 'dairy'] : [])]
      .filter((key) => !extra.includes(key) && !(key === 'noodles' && extra.includes('gluten')));
    sections.push({ id: 'ok', lines: [...chunks('ok.base', ctx, fine.map((key) => PHRASES.ok_items[key])), line('ok.stock', ctx)] });
    sections.push({ id: 'ask', lines: [line('ask.dashi', ctx), line('ask.without', ctx), line(`ask.which.${diet}`, ctx)] });
  } else {
    if (extra.length) sections.push({ id: 'avoid', lines: extra.map((key) => ({ local: lang ? item(key)[lang] : null, en: cap(item(key).en) })) });
    const ask = [];
    if (extra.length) ask.push(...chunks('ask.contains', ctx, extra.slice(0, 3).map(item)).slice(0, 1));
    if (extra.includes('fish') || extra.includes('seafood')) ask.push(line('ask.without', ctx));
    if (ask.length) sections.push({ id: 'ask', lines: ask });
  }
  sections.push({ id: 'thanks', lines: [line('thanks', ctx)] });
  const out = { v: 1 };
  if (typeof trip === 'string' && SLUG_RE.test(trip)) out.trip = trip;
  Object.assign(out, { country: c, lang, diet, party: size, fp: vegCardFp({ lang, diet, size, avoid: extra, english_only: k.english_only }),
    sections, english_only: k.english_only });
  return out;
}

// Developed by: LightAISolutions
