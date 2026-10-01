// Source-ledger entries (schemas/research-run.schema.json $defs/ledgerEntry). Every string that came from the web is
// sanitized and capped; page text is scanned for injection and then only an excerpt is kept. Nothing here parses or
// follows page text: a page cannot set any field except through the sanitized excerpt/title/snippet strings.
import { hostOf, registrableDomain, publisherKey } from './domain.mjs';
import { sanitizeText, sanitizeLine, EXCERPT_MAX, TITLE_MAX, SNIPPET_MAX } from './sanitize.mjs';
import { scanText } from './injection.mjs';
import { isoSeconds, usage } from './budget.mjs';

export const MAX_RESULTS = 20;
export const QUERY_MAX = 300;

export function entryId(n) { return 'L' + String(n).padStart(3, '0'); }

function blank(id, kind, now) {
  return {
    id, kind, status: 'ok', fetched_at: isoSeconds(now), query: null, url: null, domain: null, publisher: null,
    canonical_url: null, page_date: null, official: false, derived_from: null, http_status: null, title: '',
    excerpt: '', results: [], supports: [], contradicts: [], injection_suspect: false, injection_reasons: [], note: ''
  };
}

function cleanQuery(q, required) {
  const s = sanitizeLine(q ?? '', QUERY_MAX);
  if (required && !s) throw usage('a non-empty query is required');
  return s || null;
}

function checkUrl(url, what = 'url') {
  if (!hostOf(url)) throw usage(`${what} must be an http(s) URL (got ${JSON.stringify(String(url).slice(0, 80))})`);
  return String(url);
}

function pageDate(d) {
  if (d === undefined || d === null || d === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d)) || Number.isNaN(Date.parse(String(d)))) throw usage('page date must be YYYY-MM-DD');
  return String(d);
}

function flag(entry, scan) {
  entry.injection_suspect = scan.injection_suspect;
  entry.injection_reasons = scan.reasons.slice(0, 20);
}

/** A search: query + up to 20 results ({url, title, snippet}); results with a bad URL are dropped and counted in `note`. */
export function searchEntry(id, now, { query, results = [], failed = false, note = '' }) {
  const e = blank(id, 'search', now);
  e.query = cleanQuery(query, true);
  if (!Array.isArray(results)) throw usage('results must be a JSON array of {url, title, snippet}');
  let dropped = 0;
  for (const r of results) {
    if (e.results.length >= MAX_RESULTS) { dropped++; continue; }
    const url = r && typeof r === 'object' ? r.url : null;
    if (!hostOf(url)) { dropped++; continue; }
    const title = String(r.title ?? ''); const snippet = String(r.snippet ?? '');
    const scan = scanText(title + '\n' + snippet);
    e.results.push({
      url: String(url), domain: registrableDomain(url), publisher: publisherKey(url),
      title: sanitizeLine(title, TITLE_MAX), snippet: sanitizeLine(snippet, SNIPPET_MAX),
      injection_suspect: scan.injection_suspect, injection_reasons: scan.reasons.slice(0, 20)
    });
  }
  e.injection_suspect = e.results.some((r) => r.injection_suspect);
  e.injection_reasons = e.results.flatMap((r, i) => r.injection_reasons.map((x) => ({ rule: x.rule, sample: sanitizeLine(`#${i + 1} ${x.sample}`, 80) }))).slice(0, 20);
  if (failed) e.status = 'error';
  e.note = sanitizeLine([note, dropped ? `${dropped} result(s) dropped (bad URL or over ${MAX_RESULTS})` : ''].filter(Boolean).join('; '), 300);
  return e;
}

/**
 * A fetched page. `text` is the full page content (scanned, not stored); `excerpt` is the passage that supports a
 * claim (stored); without `excerpt` the first 1000 sanitized characters of `text` are stored.
 */
export function fetchEntry(id, now, { url, text = '', excerpt = '', title = '', query, official = false, canonical, page_date, derived_from = null, http_status = null, failed = false, note = '' }) {
  const e = blank(id, 'fetch', now);
  e.url = checkUrl(url);
  e.domain = registrableDomain(url); e.publisher = publisherKey(url);
  e.query = cleanQuery(query, false);
  if (canonical) e.canonical_url = checkUrl(canonical, 'canonical');
  e.page_date = pageDate(page_date);
  e.official = official === true;
  e.derived_from = derived_from || null;
  if (http_status !== null && http_status !== undefined && http_status !== '') {
    const n = Number(http_status);
    if (!Number.isInteger(n) || n < 100 || n > 599) throw usage('http status must be an integer 100–599');
    e.http_status = n;
  }
  flag(e, scanText([title, text, excerpt].map(String).join('\n')));
  e.title = sanitizeLine(title, TITLE_MAX);
  e.excerpt = sanitizeText(excerpt || text, EXCERPT_MAX);
  if (failed || (e.http_status !== null && e.http_status >= 400)) e.status = 'error';
  if (e.status === 'ok' && !e.excerpt) { e.status = 'error'; note = note || 'empty page text'; }
  e.note = sanitizeLine(note, 300);
  return e;
}

/** Structured data from an API the run read (e.g. a Places snapshot): `provider` is its host; `excerpt` is what it said. */
export function apiEntry(id, now, { provider, url, excerpt = '', title = '', official = false, note = '' }) {
  const e = blank(id, 'api', now);
  if (url) e.url = checkUrl(url);
  const host = provider ? String(provider).toLowerCase() : url ? hostOf(url) : null;
  if (!host || !/^[a-z0-9.-]{1,253}$/.test(host)) throw usage('api records need --provider <host> (e.g. places.googleapis.com) or a --url');
  e.domain = registrableDomain(host); e.publisher = publisherKey(host);
  e.official = official === true;
  flag(e, scanText(`${title}\n${excerpt}`));
  e.title = sanitizeLine(title, TITLE_MAX);
  e.excerpt = sanitizeText(excerpt, EXCERPT_MAX);
  if (!e.excerpt) throw usage('api records need an --excerpt (what the data said)');
  e.note = sanitizeLine(note, 300);
  return e;
}

/** A refused attempt (over budget or after finish): kept for audit, never citable. */
export function refusedEntry(id, now, { kind, query, url, note }) {
  const e = blank(id, kind === 'api' ? 'api' : kind, now);
  e.status = 'refused';
  e.query = cleanQuery(query, false);
  if (url && hostOf(url)) { e.url = String(url); e.domain = registrableDomain(url); e.publisher = publisherKey(url); }
  e.note = sanitizeLine(note, 300);
  return e;
}

// Developed by: LightAISolutions
