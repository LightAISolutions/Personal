// Claims, the two-source rule and confidence labels (README §Claims and labels). A claim is one fact a plan may depend
// on; sources are ledger refs ("L004", or "L002.3" for result 3 of search L002). Labels are recomputed at check time.
import { publisherKey } from './domain.mjs';
import { sanitizeLine } from './sanitize.mjs';
import { isoSeconds, toMs, usage } from './budget.mjs';

export const CLAIM_KINDS = ['hours', 'closed_days', 'visit_duration', 'tickets', 'price', 'other'];
/** Kinds that are always plan-critical (the two-source rule applies); `other` is critical only when asked. */
export const CRITICAL_KINDS = new Set(['hours', 'closed_days', 'visit_duration', 'tickets', 'price']);
export const LABELS = ['confirmed', 'likely', 'single-source', 'conflicting', 'stale', 'unverified'];
/** A source is stale for a kind when its page date is older than `page_days`, or it was fetched more than `fetched_days` ago. */
export const STALE_DAYS = Object.freeze({
  hours: { page_days: 365, fetched_days: 30 }, closed_days: { page_days: 365, fetched_days: 30 },
  tickets: { page_days: 365, fetched_days: 30 }, price: { page_days: 365, fetched_days: 30 },
  visit_duration: { page_days: 1095, fetched_days: 365 }, other: { page_days: 730, fetched_days: 90 }
});
export const MAX_CLAIMS = 300;
export const MAX_REFS_PER_CLAIM = 20;
export const SIMILARITY_THRESHOLD = 0.6; // word 5-shingle Jaccard at or above this = same text (syndicated copy)
const DAY_MS = 86400000;

const REF_RE = /^(L\d{3,4})(?:\.(\d{1,2}))?$/;

/** Resolve a ref to a source view, or throw a usage error. */
export function resolveRef(state, ref) {
  const m = REF_RE.exec(String(ref));
  if (!m) throw usage(`bad source ref ${JSON.stringify(ref)} (use L004 or L002.3)`);
  const entry = state.ledger.find((e) => e.id === m[1]);
  if (!entry) throw usage(`no ledger entry ${m[1]}`);
  if (entry.kind === 'search') {
    if (!m[2]) throw usage(`${ref} is a search; cite one of its results as ${m[1]}.<n>`);
    const r = entry.results[Number(m[2]) - 1];
    if (!r) throw usage(`${m[1]} has no result ${m[2]}`);
    return { ref: String(ref), entry_id: entry.id, kind: 'snippet', status: entry.status, url: r.url, publisher: r.publisher, keys: [r.publisher],
      text: r.snippet, injection_suspect: r.injection_suspect, official: false, page_date: null, fetched_at: entry.fetched_at };
  }
  if (m[2]) throw usage(`${m[1]} is not a search; cite it as ${m[1]}`);
  const keys = [entry.publisher];
  if (entry.canonical_url) keys.push(publisherKey(entry.canonical_url));
  if (entry.derived_from) { const d = state.ledger.find((e) => e.id === entry.derived_from); if (d && d.publisher) keys.push(d.publisher); }
  return { ref: entry.id, entry_id: entry.id, kind: entry.kind, status: entry.status, url: entry.url, publisher: entry.publisher, keys: keys.filter(Boolean),
    text: entry.excerpt, injection_suspect: entry.injection_suspect, official: entry.official, page_date: entry.page_date, fetched_at: entry.fetched_at };
}

/** Create a claim or add sources to an existing one (sources are unioned; text/kind/place change only when given). */
export function upsertClaim(state, input, now) {
  const id = String(input.id || '');
  if (!/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(id)) throw usage('claim id must match [a-z0-9][a-z0-9_.-]{0,63}');
  const existing = state.claims.find((x) => x.id === id);
  const kind = input.kind || (existing && existing.kind);
  if (!CLAIM_KINDS.includes(kind)) throw usage(`claim kind must be one of ${CLAIM_KINDS.join(', ')}`);
  const text = input.text ? sanitizeLine(input.text, 500) : existing ? existing.text : '';
  if (!text) throw usage(existing ? 'claim text is empty after sanitizing' : 'a new claim needs --text');
  if (!existing && state.claims.length >= MAX_CLAIMS) throw usage(`too many claims (${MAX_CLAIMS})`);
  // Validate every ref before anything changes, so a refused call leaves the run untouched.
  const next = { supports: existing ? [...existing.supports] : [], contradicts: existing ? [...existing.contradicts] : [] };
  const links = [];
  for (const field of ['supports', 'contradicts']) {
    for (const ref of input[field] || []) {
      const src = resolveRef(state, ref);
      if (src.status !== 'ok') throw usage(`${ref} has status ${src.status} and cannot be cited`);
      const other = field === 'supports' ? 'contradicts' : 'supports';
      if (next[other].includes(src.ref)) throw usage(`${src.ref} cannot both support and contradict ${id}`);
      if (!next[field].includes(src.ref)) next[field].push(src.ref);
      links.push([field, src.entry_id]);
    }
    if (next[field].length > MAX_REFS_PER_CLAIM) throw usage(`claim ${id} would have more than ${MAX_REFS_PER_CLAIM} ${field}`);
  }
  const at = isoSeconds(now);
  const c = existing || { id, text, kind, place: null, plan_critical: false, supports: [], contradicts: [], created_at: at, updated_at: at };
  if (!existing) state.claims.push(c);
  c.text = text; c.kind = kind;
  if (input.place) c.place = sanitizeLine(input.place, 120) || null;
  c.plan_critical = CRITICAL_KINDS.has(kind) || input.critical === true || c.plan_critical;
  c.supports = next.supports; c.contradicts = next.contradicts; c.updated_at = at;
  for (const [field, entryId] of links) {
    const entry = state.ledger.find((e) => e.id === entryId);
    if (!entry[field].includes(id)) entry[field].push(id);
  }
  return c;
}

export function isStale(kind, src, now) {
  const lim = STALE_DAYS[kind] || STALE_DAYS.other;
  const t = toMs(now);
  if (t - Date.parse(src.fetched_at) > lim.fetched_days * DAY_MS) return true;
  return src.page_date ? t - Date.parse(src.page_date + 'T00:00:00Z') > lim.page_days * DAY_MS : false;
}

function shingles(text) {
  const w = String(text).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  if (w.length < 12) return null;
  const s = new Set();
  for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' '));
  return s;
}

/** Jaccard similarity of word 5-shingles; 0 when either text has fewer than 12 words. */
export function textSimilarity(a, b) {
  const A = shingles(a), B = shingles(b);
  if (!A || !B) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Group sources that are not independent: shared publisher key (incl. canonical / derived-from) or near-identical text. */
export function independenceGroups(sources) {
  const parent = sources.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const shareKey = sources[i].keys.some((k) => sources[j].keys.includes(k));
      if (shareKey || textSimilarity(sources[i].text, sources[j].text) >= SIMILARITY_THRESHOLD) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  sources.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s); });
  return [...groups.values()];
}

/** Label one claim at `now` (README §Claims and labels for the exact rules). */
export function labelClaim(state, claim, now) {
  const ignored = [];
  const usable = (refs) => refs.map((r) => resolveRef(state, r)).filter((s) => {
    if (s.status !== 'ok') { ignored.push({ ref: s.ref, why: `status ${s.status}` }); return false; }
    if (s.injection_suspect) { ignored.push({ ref: s.ref, why: 'injection_suspect' }); return false; }
    return true;
  });
  const sup = usable(claim.supports);
  const con = usable(claim.contradicts);
  const fresh = sup.filter((s) => !isStale(claim.kind, s, now));
  sup.filter((s) => !fresh.includes(s)).forEach((s) => ignored.push({ ref: s.ref, why: 'stale' }));
  const groups = independenceGroups(fresh);
  const solid = groups.filter((g) => g.some((s) => s.kind !== 'snippet')).length;
  let label;
  if (con.length) label = 'conflicting';
  else if (!sup.length) label = 'unverified';
  else if (!fresh.length) label = 'stale';
  else if (groups.length >= 2 && solid >= 1) label = 'confirmed';
  else if (groups.length >= 2 || groups[0].some((s) => s.official)) label = 'likely';
  else label = 'single-source';
  const plan_ready = claim.plan_critical ? label === 'confirmed' : ['confirmed', 'likely', 'single-source'].includes(label);
  return {
    id: claim.id, kind: claim.kind, place: claim.place, plan_critical: claim.plan_critical, label, plan_ready,
    independent_sources: groups.length, groups: groups.map((g) => g.map((s) => s.ref)),
    contradicted_by: con.map((s) => s.ref), ignored
  };
}

// Developed by: LightAISolutions
