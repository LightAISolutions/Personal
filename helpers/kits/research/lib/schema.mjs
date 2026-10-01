// Minimal JSON Schema subset validator (type, const, enum, pattern, minLength, maxLength, minimum, maximum,
// required, properties, additionalProperties:false, items, maxItems, $ref to #/$defs) — enough for the kit's own
// schemas/research-run.schema.json, which is the single source of truth for the run file shape.
import { readFileSync } from 'node:fs';

export const RUN_SCHEMA = JSON.parse(readFileSync(new URL('../schemas/research-run.schema.json', import.meta.url), 'utf8'));

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(want, got) {
  return want === got || (want === 'number' && got === 'integer');
}

/** Returns a list of "path: problem" strings; empty when `value` conforms. */
export function validate(value, schema = RUN_SCHEMA, root = schema, path = '$', errors = []) {
  if (errors.length >= 20) return errors;
  if (schema.$ref) {
    const m = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    if (!m || !root.$defs || !root.$defs[m[1]]) throw new Error(`unsupported $ref ${schema.$ref}`);
    return validate(value, root.$defs[m[1]], root, path, errors);
  }
  const t = typeOf(value);
  if ('const' in schema && value !== schema.const) errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((w) => typeMatches(w, t))) { errors.push(`${path}: expected ${types.join('|')}, got ${t}`); return errors; }
  }
  if (t === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => validate(v, schema.items, root, `${path}[${i}]`, errors));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errors.push(`${path}: missing ${k}`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(v, props[k], root, `${path}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}: unknown key ${k}`);
    }
  }
  return errors;
}

// Developed by: LightAISolutions
