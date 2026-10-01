/**
 * Brochure kit — a small JSON Schema (draft 2020-12 subset) validator, enough for schema/brochure.schema.json:
 * type, const, enum, properties, required, additionalProperties, propertyNames, maxProperties, items, minItems,
 * maxItems, minLength, maxLength, pattern, minimum, maximum, anyOf, $ref (#/$defs/… only). No dependency, no
 * code generation. Errors carry a JSON-pointer path and a plain message.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema', 'brochure.schema.json');
let cached = null;
export function loadSchema() { return cached || (cached = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))); }

const typeOf = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;
const typeOk = (v, t) => t === 'number' ? typeof v === 'number' && Number.isFinite(v) : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t;

/** validate(value, schema = loadSchema()) → [] when valid, else [{ path: '/days/0/stops/1/arrive', message }] (max 50). */
export function validate(value, schema = loadSchema()) {
  const errors = [];
  const root = schema;
  const deref = (s) => {
    if (!s || !s.$ref) return s;
    const m = /^#\/\$defs\/([^/]+)$/.exec(s.$ref);
    if (!m || !root.$defs || !root.$defs[m[1]]) throw new Error('unsupported $ref ' + s.$ref);
    return { ...root.$defs[m[1]], ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== '$ref')) };
  };
  const push = (path, message) => { if (errors.length < 50) errors.push({ path: path || '/', message }); };
  function check(v, s, path) {
    s = deref(s);
    if (!s || errors.length >= 50) return;
    const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : null;
    if (types && !types.some((t) => typeOk(v, t))) return push(path, `expected ${types.join(' or ')}, got ${typeOf(v)}`);
    if ('const' in s && v !== s.const) return push(path, `must be ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(v)) return push(path, `must be one of ${s.enum.map((e) => JSON.stringify(e)).join(', ')}`);
    if (typeof v === 'string') {
      if (s.minLength !== undefined && v.length < s.minLength) push(path, `shorter than ${s.minLength} characters`);
      if (s.maxLength !== undefined && v.length > s.maxLength) push(path, `longer than ${s.maxLength} characters`);
      if (s.pattern && !new RegExp(s.pattern).test(v)) push(path, `does not match ${s.pattern}` + (s.description ? ` (${s.description.split('.')[0]})` : ''));
    }
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) push(path, `below minimum ${s.minimum}`);
      if (s.maximum !== undefined && v > s.maximum) push(path, `above maximum ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) push(path, `needs at least ${s.minItems} item(s)`);
      if (s.maxItems !== undefined && v.length > s.maxItems) push(path, `more than ${s.maxItems} items`);
      if (s.items) v.forEach((x, i) => check(x, s.items, `${path}/${i}`));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) checkObject(v, s, path);
    if (s.anyOf && !s.anyOf.some((alt) => validate(v, { $defs: root.$defs, ...deref(alt) }).length === 0)) push(path, 'matches none of the allowed shapes');
  }
  function checkObject(v, s, path) {
    const keys = Object.keys(v);
    (s.required || []).forEach((k) => { if (!(k in v)) push(path, `missing required "${k}"`); });
    if (s.maxProperties !== undefined && keys.length > s.maxProperties) push(path, `more than ${s.maxProperties} entries`);
    for (const k of keys) {
      if (s.propertyNames && s.propertyNames.pattern && !new RegExp(s.propertyNames.pattern).test(k)) push(`${path}/${k}`, `key does not match ${s.propertyNames.pattern}`);
      const p = s.properties && s.properties[k];
      if (p) check(v[k], p, `${path}/${k}`);
      else if (s.additionalProperties === false) push(`${path}/${k}`, 'unknown field');
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') check(v[k], s.additionalProperties, `${path}/${k}`);
    }
  }
  check(value, schema, '');
  return errors;
}
export const formatErrors = (errs) => errs.map((e) => `${e.path}: ${e.message}`).join('\n');

// Developed by: LightAISolutions
