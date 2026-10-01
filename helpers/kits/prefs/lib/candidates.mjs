/**
 * Prefs kit — group normalised evidence into candidate preferences. A candidate is one (dimension, value) pair; its
 * stance (+ prefers / - avoids) is the majority of the evidence that is NOT injection_suspect. Suspect evidence is kept
 * and counted separately but never adds support. Candidates are recomputed from all held evidence on every run, so the
 * result depends only on the evidence set, never on the order it arrived in.
 */
import { sha } from './util.mjs';

export const DEFAULT_MIN_SUPPORT = 1;

/** candidateId('food', 'street food') -> 'c_' + 10 hex. Short enough for Telegram callback data. */
export function candidateId(dimension, value) { return 'c_' + sha('prefs-cand', dimension, value).slice(0, 10); }

const byDateDescThenId = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * buildCandidates(records, vocab, {minSupport}) -> [candidate] in vocabulary order, then by value.
 * candidate = {id, dimension, value, cardinality, stance, support, pro, con, suspect, sources, first_seen, last_seen,
 *              evidence (newest first), rivals, proposable, hold_reason}
 */
export function buildCandidates(records, vocab, { minSupport = DEFAULT_MIN_SUPPORT } = {}) {
  const groups = new Map();
  for (const r of records) {
    const id = candidateId(r.dimension, r.value);
    if (!groups.has(id)) groups.set(id, { id, dimension: r.dimension, value: r.value, evidence: new Map() });
    groups.get(id).evidence.set(r.id, r);
  }
  const out = [];
  for (const g of groups.values()) {
    const ev = [...g.evidence.values()].sort(byDateDescThenId);
    const clean = ev.filter((r) => !r.injection_suspect);
    const pro = clean.filter((r) => r.polarity === '+').length, con = clean.length - pro;
    const dim = vocab.dims.get(g.dimension);
    const stance = pro >= con ? '+' : '-';
    const c = {
      id: g.id, dimension: g.dimension, value: g.value, cardinality: dim ? dim.cardinality : 'many', stance,
      support: stance === '+' ? pro : con, pro, con, suspect: ev.length - clean.length,
      sources: [...new Set(clean.map((r) => r.source_kind))].sort(),
      first_seen: ev.length ? ev[ev.length - 1].date : null, last_seen: ev.length ? ev[0].date : null,
      evidence: ev, rivals: [], proposable: true, hold_reason: null
    };
    if (!dim) c.hold_reason = 'unknown_dimension';
    else if (!clean.length) c.hold_reason = 'suspect_only';
    else if (pro === con) c.hold_reason = 'tied';
    else if (c.support < minSupport) c.hold_reason = 'low_support';
    else if (c.cardinality === 'one' && stance === '-') c.hold_reason = 'negative_single_value';
    c.proposable = !c.hold_reason;
    out.push(c);
  }
  // Rivals: other values of a "one" dimension with positive support conflict with each other.
  for (const c of out) {
    if (c.cardinality !== 'one') continue;
    c.rivals = out.filter((o) => o.dimension === c.dimension && o.id !== c.id && o.pro > 0)
      .map((o) => ({ value: o.value, pro: o.pro })).sort((a, b) => b.pro - a.pro || (a.value < b.value ? -1 : 1));
  }
  const order = [...vocab.dims.keys()];
  return out.sort((a, b) => order.indexOf(a.dimension) - order.indexOf(b.dimension) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}

// Developed by: LightAISolutions
