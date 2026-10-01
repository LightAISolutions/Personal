/**
 * Maps kit — the SKU usage ledger and its hard stop. Routines run in throwaway containers, so the counter lives in a
 * JSON file the CALLER names (option `path` or env MAPS_USAGE_LEDGER), e.g. a memory directory in the helper's private
 * repo. Format (v1):
 *   { "v": 1, "kind": "maps-usage-ledger", "tz": "America/Los_Angeles", "updated_at": ISO,
 *     "months": { "2026-10": { "places.details.enterprise": { "units": 3, "requests": 3, "failed": 0 }, … } } }
 * `units` is what Google bills (requests, or elements for Route Matrix) and is what the ceiling is checked against.
 * Counting happens BEFORE the request is sent (reserve), so a call that fails still counts: conservative by design.
 * Month keys use the billing time zone (default America/Los_Angeles — Cloud Billing months run on Pacific time).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SKUS, resolveCeilings } from './maps-skus.mjs';
import { MapsBudgetError } from './maps-errors.mjs';

export const LEDGER_KIND = 'maps-usage-ledger';
export const DEFAULT_BILLING_TZ = 'America/Los_Angeles';

/** monthKey(new Date('2026-11-01T03:00:00Z'), 'America/Los_Angeles') → '2026-10' */
export function monthKey(date, tz = DEFAULT_BILLING_TZ) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(date);
  return parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value;
}
export function emptyLedger(tz = DEFAULT_BILLING_TZ) { return { v: 1, kind: LEDGER_KIND, tz, updated_at: null, months: {} }; }
function validate(doc) {
  if (!doc || doc.v !== 1 || doc.kind !== LEDGER_KIND || typeof doc.months !== 'object') throw new Error('maps: not a v1 maps usage ledger');
  return doc;
}

/**
 * createLedger({ path?, ceilings?, tz?, now? }) — without `path` the ledger is in memory (tests, dry runs).
 * reserve(sku, units) throws MapsBudgetError when used + units > ceiling; otherwise counts and persists, then returns
 * the new total. markFailed(sku) only annotates. usage(month?) returns a report with ceilings and free caps.
 */
export function createLedger({ path = null, ceilings = {}, tz, now = () => new Date() } = {}) {
  const limits = resolveCeilings(ceilings);
  let mem = null;
  const load = () => {
    if (!path) return (mem ||= emptyLedger(tz || DEFAULT_BILLING_TZ));
    if (!existsSync(path)) return emptyLedger(tz || DEFAULT_BILLING_TZ);
    return validate(JSON.parse(readFileSync(path, 'utf8')));
  };
  const save = (doc) => {
    doc.updated_at = now().toISOString();
    if (!path) { mem = doc; return; }
    mkdirSync(dirname(path), { recursive: true });
    const tmp = path + '.tmp-' + process.pid;
    writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
    renameSync(tmp, path);
  };
  const row = (doc, month, sku) => ((doc.months[month] ||= {})[sku] ||= { units: 0, requests: 0, failed: 0 });

  return {
    path,
    ceilings: limits,
    /** Check-then-count. Throws before anything is written when the ceiling would be passed. */
    reserve(sku, units = 1) {
      if (!(sku in SKUS)) throw new Error('maps: unknown SKU ' + sku);
      if (!Number.isInteger(units) || units < 1) throw new Error('maps: units must be a positive integer');
      const doc = load();
      const month = monthKey(now(), doc.tz || DEFAULT_BILLING_TZ);
      const used = doc.months[month]?.[sku]?.units || 0;
      if (used + units > limits[sku]) throw new MapsBudgetError(sku, month, used, units, limits[sku]);
      const r = row(doc, month, sku);
      r.units += units;
      r.requests += 1;
      save(doc);
      return r.units;
    },
    /** Remaining units for `sku` this month (never negative). */
    remaining(sku) {
      const doc = load();
      const used = doc.months[monthKey(now(), doc.tz || DEFAULT_BILLING_TZ)]?.[sku]?.units || 0;
      return Math.max(0, limits[sku] - used);
    },
    markFailed(sku) {
      const doc = load();
      row(doc, monthKey(now(), doc.tz || DEFAULT_BILLING_TZ), sku).failed += 1;
      save(doc);
    },
    /** usage() → { month, tz, skus: [{ sku, label, unit, units, requests, failed, ceiling, free }] } (every SKU listed). */
    usage(month) {
      const doc = load();
      const m = month || monthKey(now(), doc.tz || DEFAULT_BILLING_TZ);
      const rows = doc.months[m] || {};
      return {
        month: m,
        tz: doc.tz || DEFAULT_BILLING_TZ,
        skus: Object.entries(SKUS).map(([sku, s]) => ({ sku, label: s.label, unit: s.unit, units: rows[sku]?.units || 0, requests: rows[sku]?.requests || 0, failed: rows[sku]?.failed || 0, ceiling: limits[sku], free: Number.isFinite(s.free) ? s.free : null }))
      };
    },
    snapshot() { return JSON.parse(JSON.stringify(load())); }
  };
}

// Developed by: LightAISolutions
