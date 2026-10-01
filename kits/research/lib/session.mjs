// Library form of the run contract for a Node driver: search and fetch are injected functions; the budget is checked
// BEFORE each call (an over-budget call is never made), and the ledger is written as calls happen. Whatever the
// injected functions return is untrusted: only url/title/snippet (search) and url/text/title/canonical/page_date/
// status (fetch) are read, every string is sanitized, and nothing in a page can change budgets or fields.
import * as run from './run.mjs';
import { checkSpend, remaining } from './budget.mjs';
import { sourceTags } from './ledger.mjs';

/** { source_kind | sourceKind, language } from the caller's options → validated tags (before any injected call runs). */
const tagsOf = (opts = {}) => sourceTags({ source_kind: opts.source_kind ?? opts.sourceKind, language: opts.language });

export class BudgetExhaustedError extends Error {
  constructor(result) { super(result.message); this.name = 'BudgetExhaustedError'; this.code = result.code; this.entry = result.entry; this.exitCode = 3; }
}

const str = (v) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

export class ResearchSession {
  /** @param {{state: object, search?: (q: string) => Promise<Array>, fetch?: (url: string) => Promise<object>, clock?: () => number}} o */
  constructor({ state, search, fetch, clock = () => Date.now() }) {
    this.state = run.assertValid(state);
    this._search = search; this._fetch = fetch; this.clock = clock;
  }

  static start({ topic, budgets, search, fetch, clock = () => Date.now() }) {
    return new ResearchSession({ state: run.startRun({ topic, budgets, now: clock() }), search, fetch, clock });
  }

  /** Run one search through the injected function; `opts` = { source_kind, language } tags the entry. Throws
   * BudgetExhaustedError (without calling it) when spent, and a usage error (without calling it) on a bad tag. */
  async search(query, opts = {}) {
    if (typeof this._search !== 'function') throw new Error('no search function injected');
    const tags = tagsOf(opts);
    const now = this.clock();
    const pre = this._precheck('search', { query }, now);
    if (pre) throw pre;
    let results = [], failed = false, note = '';
    try {
      const out = await this._search(String(query));
      results = Array.isArray(out) ? out.map((r) => ({ url: r && r.url, title: str(r && r.title), snippet: str(r && r.snippet) })) : [];
      if (!Array.isArray(out)) { failed = true; note = 'search returned no result list'; }
    } catch (err) { failed = true; note = `search failed: ${str(err && err.message)}`; }
    return run.record(this.state, 'search', { query, results, failed, note, ...tags }, now).entry;
  }

  /** Fetch one page through the injected function; `opts` = { query, official, excerpt, derived_from, source_kind, language }. */
  async fetch(url, opts = {}) {
    if (typeof this._fetch !== 'function') throw new Error('no fetch function injected');
    const tags = tagsOf(opts);
    const now = this.clock();
    const pre = this._precheck('fetch', { url, query: opts.query }, now);
    if (pre) throw pre;
    let page = {}, failed = false, note = '';
    try { page = (await this._fetch(String(url))) || {}; } catch (err) { failed = true; note = `fetch failed: ${str(err && err.message)}`; }
    const status = Number.isInteger(page.status) && page.status >= 100 && page.status <= 599 ? page.status : null;
    return run.record(this.state, 'fetch', {
      url, text: str(page.text), title: str(page.title), excerpt: str(opts.excerpt), query: opts.query,
      official: opts.official === true, canonical: typeof page.canonical === 'string' && /^https?:\/\//.test(page.canonical) ? page.canonical : undefined,
      page_date: typeof page.page_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(page.page_date) ? page.page_date : undefined,
      derived_from: opts.derived_from || null, http_status: status, failed: failed || !str(page.text), note: note || (str(page.text) ? '' : 'empty page'), ...tags
    }, now).entry;
  }

  /** Record structured data the driver read elsewhere (counts against the api cap, not the web budgets). */
  recordApi(input) {
    const r = run.record(this.state, 'api', input, this.clock());
    if (!r.ok) throw new BudgetExhaustedError(r);
    return r.entry;
  }

  /** Budget check before the injected call; a refusal is logged (no content) and returned as an error to throw. */
  _precheck(kind, input, now) {
    if (checkSpend(this.state, kind, now).ok) return null;
    return new BudgetExhaustedError(run.record(this.state, kind, input, now));
  }

  claim(input) { return run.claim(this.state, input, this.clock()); }
  /** Usable web sources with their source kind and language (see run.mentions). */
  mentions(filter) { return run.mentions(this.state, filter); }
  check() { return run.check(this.state, this.clock()); }
  duration(specs) { return run.duration(this.state, specs); }
  remaining() { return remaining(this.state, this.clock()); }
  finish() { return run.finish(this.state, this.clock()); }
  toJSON() { return this.state; }
}

// Developed by: LightAISolutions
