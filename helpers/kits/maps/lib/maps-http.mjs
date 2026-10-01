/**
 * Maps kit — one guarded call: reserve units on the ledger (hard stop BEFORE sending), send with the fixed field mask,
 * parse JSON, turn non-2xx answers into MapsRequestError. Key handling: in Claude Code cloud environments the egress
 * proxy adds `X-Goog-Api-Key` for places/routes.googleapis.com, so `apiKey` is absent and no key is sent; elsewhere the
 * caller may pass `apiKey` explicitly (never read from a repo file). The key never appears in errors or results.
 */
import { MapsRequestError } from './maps-errors.mjs';

export const PLACES_BASE = 'https://places.googleapis.com/v1';
export const ROUTES_BASE = 'https://routes.googleapis.com';

/** Google error JSON → short message (no headers, no key). */
function googleMessage(text) {
  try { const j = JSON.parse(text); const e = Array.isArray(j) ? j[0]?.error : j.error; if (e) return { status: e.status || null, message: String(e.message || '').slice(0, 300) }; } catch { /* not JSON */ }
  return { status: null, message: String(text || '').slice(0, 200) };
}

/**
 * guardedCall(ctx, { sku, units, method, url, mask, body }) → { data, status, ms, sku, units }
 * ctx = { transport, ledger, apiKey?, timeoutMs? }
 */
export async function guardedCall(ctx, { sku, units = 1, method, url, mask, body = null }) {
  ctx.ledger.reserve(sku, units); // throws MapsBudgetError → nothing sent
  const headers = { 'Content-Type': 'application/json' };
  if (mask) headers['X-Goog-FieldMask'] = mask; // photo media has no mask
  if (ctx.apiKey) headers['X-Goog-Api-Key'] = ctx.apiKey;
  let res;
  try {
    res = await ctx.transport({ method, url, headers, body, timeoutMs: ctx.timeoutMs || 20000 });
  } catch (e) {
    ctx.ledger.markFailed(sku);
    throw e;
  }
  if (res.status < 200 || res.status >= 300) {
    ctx.ledger.markFailed(sku);
    const g = googleMessage(res.text);
    const code = res.status === 401 || res.status === 403 ? 'AUTH' : res.status === 429 ? 'QUOTA' : res.status >= 500 ? 'UPSTREAM' : 'HTTP_' + res.status;
    throw new MapsRequestError(code, `maps: ${sku} answered HTTP ${res.status}${g.status ? ' ' + g.status : ''}${g.message ? ': ' + g.message : ''}`, { status: res.status, apiStatus: g.status, sku });
  }
  let data;
  try { data = res.text ? JSON.parse(res.text) : {}; } catch { throw new MapsRequestError('BAD_JSON', `maps: ${sku} returned non-JSON`, { status: res.status, sku }); }
  return { data, status: res.status, ms: res.ms ?? null, sku, units };
}

// Developed by: LightAISolutions
