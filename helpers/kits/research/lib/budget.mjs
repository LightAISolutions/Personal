// Per-run budgets: searches, fetches and wall time. The kit refuses to record (CLI) or to perform (library) a
// search or fetch once its budget is spent or the wall time since started_at is over (README §Budgets).

export const DEFAULT_BUDGETS = Object.freeze({ searches: 20, fetches: 40, wall_time_s: 1800 });
export const MAX_BUDGETS = Object.freeze({ searches: 100, fetches: 200, wall_time_s: 10800 });
export const MAX_API_RECORDS = 200;   // `api` entries (e.g. a Places snapshot) are not a web budget but are capped
export const MAX_REFUSED_RECORDS = 50; // refused attempts kept for audit; beyond this they are not even recorded

const KIND_TO_BUDGET = { search: 'searches', fetch: 'fetches' };

/** Defaults filled in, every value an integer in [1, max]; throws a usage error otherwise. */
export function normalizeBudgets(input = {}) {
  const out = {};
  for (const key of Object.keys(DEFAULT_BUDGETS)) {
    const raw = input[key];
    const v = raw === undefined || raw === null || raw === '' ? DEFAULT_BUDGETS[key] : Number(raw);
    if (!Number.isInteger(v) || v < 1 || v > MAX_BUDGETS[key]) {
      throw usage(`budget ${key} must be an integer from 1 to ${MAX_BUDGETS[key]} (got ${JSON.stringify(raw)})`);
    }
    out[key] = v;
  }
  return out;
}

export function wallDeadline(state) {
  return Date.parse(state.started_at) + state.budgets.wall_time_s * 1000;
}

/** Remaining budget at `now`: { searches, fetches, wall_time_s, api }. */
export function remaining(state, now) {
  const t = toMs(now);
  return {
    searches: Math.max(0, state.budgets.searches - state.counters.searches),
    fetches: Math.max(0, state.budgets.fetches - state.counters.fetches),
    wall_time_s: Math.max(0, Math.floor((wallDeadline(state) - t) / 1000)),
    api: Math.max(0, MAX_API_RECORDS - state.counters.api)
  };
}

/**
 * May one more `kind` ('search' | 'fetch' | 'api') be spent at `now`? Returns { ok: true } or
 * { ok: false, code, message } with code 'run_finished' | 'wall_time' | 'searches' | 'fetches' | 'api'.
 */
export function checkSpend(state, kind, now) {
  if (state.status !== 'open') return refuse('run_finished', 'the run is finished; start a new run');
  const t = toMs(now);
  if (t > wallDeadline(state)) return refuse('wall_time', `wall time spent (${state.budgets.wall_time_s} s since ${state.started_at})`);
  if (kind === 'api') {
    return state.counters.api >= MAX_API_RECORDS ? refuse('api', `api records spent (${MAX_API_RECORDS})`) : { ok: true };
  }
  const b = KIND_TO_BUDGET[kind];
  if (!b) throw new Error(`unknown spend kind ${kind}`);
  if (state.counters[b] >= state.budgets[b]) return refuse(b, `${b} budget spent (${state.counters[b]}/${state.budgets[b]})`);
  return { ok: true };
}

export function toMs(now) {
  const t = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(t)) throw new Error('invalid clock value');
  return t;
}

export function isoSeconds(now) {
  return new Date(toMs(now)).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function refuse(code, message) { return { ok: false, code, message: `BUDGET_EXHAUSTED: ${message}` }; }

export function usage(message) { const e = new Error(message); e.exitCode = 2; return e; }

// Developed by: LightAISolutions
