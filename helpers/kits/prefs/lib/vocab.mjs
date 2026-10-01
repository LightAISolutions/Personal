/**
 * Prefs kit — the caller-supplied preference vocabulary. The kit knows nothing about travel: every dimension a
 * profile may hold (id, label, one value or many, optional closed value list) comes from a vocabulary file or a named
 * preset in presets/<name>.vocab.json.
 *
 * {"v":1, "name":"travel", "title":"Travel profile", "max_tokens":2000,
 *  "dimensions":[{"id":"pace", "label":"Pace", "cardinality":"one", "values":["relaxed","normal","packed"]},
 *                {"id":"food", "label":"Food", "cardinality":"many", "polarity_labels":{"+":"likes","-":"avoids"}}]}
 * "one" dimensions need a closed values list (the profile holds one of them); "many" dimensions may be open.
 * Optional per dimension: "examples" (open dimensions only — starter values an interview may offer as buttons; the
 * list does not close the dimension) and "default" (what a consumer may assume when the owner never answered; it is
 * never written to the profile).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normValue } from './util.mjs';

export const PRESETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'presets');
export const VALUE_MAX = 60;
const ID_RE = /^[a-z][a-z0-9_]{0,31}$/;

export const MAX_EXAMPLES = 30;

/**
 * A dimension's default: what a consumer may assume when the owner never answered. It is NOT a preference and never
 * enters the profile (only owner decisions do). "one": a value of the closed list. "many": [{value, polarity}].
 */
function readDefault(raw, cardinality, values) {
  const legal = (v) => { const n = normValue(v); return n && n.length <= VALUE_MAX && (!values || values.includes(n)) ? n : null; };
  if (cardinality === 'one') {
    const v = typeof raw === 'string' ? legal(raw) : null;
    return v ? { value: v } : { error: 'default must be one of the values' };
  }
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_EXAMPLES) return { error: 'default must be a non-empty array of {value, polarity}' };
  const out = [];
  for (const x of raw) {
    const v = x && typeof x === 'object' && typeof x.value === 'string' ? legal(x.value) : null;
    if (!v || !['+', '-'].includes(x.polarity) || Object.keys(x).some((k) => k !== 'value' && k !== 'polarity')) return { error: 'default items must be {value, polarity} with a legal value and polarity + or -' };
    out.push({ value: v, polarity: x.polarity });
  }
  return { value: out };
}

/** validateVocab(obj) -> {vocab, errors}; vocab.dims is a Map id -> dimension with normalised closed values. */
export function validateVocab(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { vocab: null, errors: ['vocabulary must be a JSON object'] };
  if (raw.v !== 1) errors.push('vocabulary v must be 1');
  if (!ID_RE.test(String(raw.name || ''))) errors.push('vocabulary name must match ' + ID_RE);
  const maxTokens = raw.max_tokens == null ? 2000 : raw.max_tokens;
  if (!Number.isInteger(maxTokens) || maxTokens < 200 || maxTokens > 20000) errors.push('max_tokens must be an integer 200..20000');
  if (!Array.isArray(raw.dimensions) || !raw.dimensions.length) errors.push('dimensions must be a non-empty array');
  const dims = new Map();
  for (const d of Array.isArray(raw.dimensions) ? raw.dimensions : []) {
    const id = d && d.id;
    if (!ID_RE.test(String(id || ''))) { errors.push('dimension id must match ' + ID_RE + ': ' + JSON.stringify(id)); continue; }
    if (dims.has(id)) { errors.push('duplicate dimension: ' + id); continue; }
    if (!['one', 'many'].includes(d.cardinality)) errors.push(id + ': cardinality must be "one" or "many"');
    let values = null;
    if (d.values != null) {
      if (!Array.isArray(d.values) || !d.values.length) errors.push(id + ': values must be a non-empty array when present');
      else values = d.values.map(normValue);
    }
    if (d.cardinality === 'one' && !values) errors.push(id + ': a "one" dimension needs a closed values list');
    let polarityLabels = null;
    if (d.polarity_labels != null) {
      const pl = d.polarity_labels;
      if (!pl || typeof pl !== 'object' || ['+', '-'].some((k) => typeof pl[k] !== 'string' || !pl[k] || pl[k].length > 20)) errors.push(id + ': polarity_labels must be {"+": "...", "-": "..."} (each 1..20 chars)');
      else polarityLabels = { '+': pl['+'], '-': pl['-'] };
    }
    let examples = null;
    if (d.examples != null) {
      if (values) errors.push(id + ': examples are only for open dimensions (it has a closed values list)');
      else if (!Array.isArray(d.examples) || !d.examples.length || d.examples.length > MAX_EXAMPLES
        || d.examples.some((x) => typeof x !== 'string' || !normValue(x) || normValue(x).length > VALUE_MAX)) errors.push(id + ': examples must be 1..' + MAX_EXAMPLES + ' strings of 1..' + VALUE_MAX + ' chars');
      else examples = [...new Set(d.examples.map(normValue))];
    }
    const dflt = d.default === undefined ? { value: null } : readDefault(d.default, d.cardinality, values);
    if (dflt.error) errors.push(id + ': ' + dflt.error);
    dims.set(id, { id, label: String(d.label || id).slice(0, 40), cardinality: d.cardinality, values, polarity_labels: polarityLabels,
      hint: d.hint ? String(d.hint).slice(0, 200) : '', examples, default: dflt.value });
  }
  if (errors.length) return { vocab: null, errors };
  return { vocab: { name: raw.name, title: String(raw.title || raw.name).slice(0, 60), max_tokens: maxTokens, dims }, errors };
}

/** loadVocab('travel' | '/path/to/file.json') -> vocab; throws with every error. */
export function loadVocab(nameOrPath) {
  const preset = join(PRESETS_DIR, String(nameOrPath) + '.vocab.json');
  const file = /^[a-z][a-z0-9_-]*$/.test(String(nameOrPath)) && existsSync(preset) ? preset : String(nameOrPath);
  if (!existsSync(file)) throw new Error('vocabulary not found: ' + nameOrPath + ' (a preset name or a JSON file)');
  const { vocab, errors } = validateVocab(JSON.parse(readFileSync(file, 'utf8')));
  if (errors.length) throw new Error('invalid vocabulary ' + nameOrPath + ':\n  ' + errors.join('\n  '));
  return vocab;
}

/** checkValue(vocab, dimId, value) -> {value, error}; normalises and enforces the closed list and length. */
export function checkValue(vocab, dimId, value) {
  const dim = vocab.dims.get(dimId);
  if (!dim) return { value: null, error: 'unknown dimension: ' + dimId };
  const v = normValue(value);
  if (!v) return { value: null, error: dimId + ': empty value' };
  if (v.length > VALUE_MAX) return { value: null, error: dimId + ': value longer than ' + VALUE_MAX + ' chars' };
  if (dim.values && !dim.values.includes(v)) return { value: null, error: dimId + ': "' + v + '" is not one of ' + dim.values.join(', ') };
  return { value: v, error: null };
}

// Developed by: LightAISolutions
