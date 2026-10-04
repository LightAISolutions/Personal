#!/usr/bin/env node
/**
 * Tour Guide — Lists: the Takeout fetch, client half (TG-PHASE-14 WP-14f). A routine tool, mirroring
 * helpers/tools/upload.mjs the other way round: it asks the core's ?route=takeout (gas/28_lists.js) for the owner's newest
 * Google Takeout export in Drive and writes its parts, byte for byte, into a scratch directory for readSavedExports().
 * The Drive connector would hand the archive over as base64 text to copy by hand; one wrong character corrupts a zip.
 * Zero dependencies; curl, so the environment's proxy applies, with -L because Apps Script answers with a redirect.
 *
 *   node lists-fetch.mjs --wake-url <state.json wake_url> --key-from <saved req_<id>.json> --out <dir>
 *        [--newer-than <stamp>] [--list]
 *
 * --key-from reads the request id and payload.upload_key from the request file the routine saved (keyFrom, as upload.mjs
 * does); the key is never typed, printed or logged. Prints exactly one JSON line. Exit 0 fetched (or listed), 2 nothing
 * to fetch, 1 a failure or bad arguments. Not re-exported from lists/index.mjs: the engine stays pure (node:zlib only).
 * Contract and caps: lists/README.md "Fetching the export".
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keyFrom } from '../../../tools/upload.mjs';

/** A Takeout part's name (the core's TG_LISTS.TAKEOUT_RE; a test keeps them equal): stamp, optional middle number, part. */
export const TAKEOUT_RE = /^takeout-(\d{8}T\d{6}Z)(?:-(\d{1,3}))?-(\d{1,4})\.(zip|tgz)$/i;
const STAMP_RE = /^\d{8}T\d{6}Z$/i;
const REASON_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** takeoutUrl('https://script.google.com/macros/s/X/exec?route=wake') → '…/exec?route=takeout' (https only). */
export function takeoutUrl(wakeUrl) {
  const u = new URL(String(wakeUrl || ''));
  if (u.protocol !== 'https:') throw new Error('wake url must be https');
  u.search = '';
  u.searchParams.set('route', 'takeout');
  return u.toString();
}

/**
 * The default transport: POST `body` as text/plain JSON with curl (-sSL, 300 s), the body and the answer in temp files
 * that are always deleted. → the parsed answer, or null when it is not JSON. Throws 'curl failed (exit N)'; curl's own
 * error output is swallowed, and nothing here ever carries the body.
 */
export function curlRun(url, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'takeout-'));
  const inFile = path.join(dir, 'body.json'), outFile = path.join(dir, 'answer.json');
  try {
    fs.writeFileSync(inFile, JSON.stringify(body), { mode: 0o600 });
    try {
      execFileSync('curl', ['-sSL', '--max-time', '300', '-H', 'Content-Type: text/plain', '--data-binary', '@' + inFile, '-o', outFile, url],
        { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) { throw new Error('curl failed' + (Number.isInteger(e.status) ? ` (exit ${e.status})` : '')); }
    let text;
    try { text = fs.readFileSync(outFile, 'utf8'); } catch (e) { return null; }
    try { return JSON.parse(text); } catch (e) { return null; }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A part as the core lists it, or null: a Takeout part name (never a path) and a byte count. */
function cleanPart(p) {
  if (!p || typeof p !== 'object' || typeof p.name !== 'string' || /[\\/]/.test(p.name) || !TAKEOUT_RE.test(p.name)) return null;
  return Number.isInteger(p.bytes) && p.bytes >= 0 ? { name: p.name, bytes: p.bytes } : null;
}
/** The core's export list, checked, newest first (a stable sort on the stamp keeps the core's order within one) — or null. */
function cleanExports(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object' || typeof e.stamp !== 'string' || !STAMP_RE.test(e.stamp) || !Array.isArray(e.parts) || !e.parts.length) return null;
    const parts = e.parts.map(cleanPart);
    if (parts.some((p) => !p)) return null;
    out.push({ stamp: e.stamp.toUpperCase(), created: typeof e.created === 'string' ? e.created : '', bytes: Number.isInteger(e.bytes) ? e.bytes : parts.reduce((s, p) => s + p.bytes, 0),
      parts, too_large: e.too_large === true });
  }
  return out.sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
}
/** A refusal answer → { ok: false, reason } (the router's 404 not_found means the core predates the route); else null. */
function refusal(ans) {
  if (!ans || typeof ans !== 'object' || ans.ok !== false) return null;
  if (ans.status === 404 && ans.reason === 'not_found') return { ok: false, reason: 'not_deployed' };
  return { ok: false, reason: typeof ans.reason === 'string' && REASON_RE.test(ans.reason) ? ans.reason : 'bad_answer' };
}
function args(o) {
  const url = takeoutUrl(o.wakeUrl);
  const req = String(o.req || '').replace(/^req_/, '');
  if (!/^[0-9a-f-]{36}$/i.test(req)) throw new Error('req must be the request id');
  if (!/^[0-9a-f]{64}$/.test(String(o.key || ''))) throw new Error('key must be the request payload upload_key');
  return { url, req, key: String(o.key), run: typeof o.run === 'function' ? o.run : curlRun };
}
/** One call through `run`; a throw is a network failure. → { answer } | { fail } */
async function call(run, url, body) {
  try { return { answer: await run(url, body) }; } catch (e) { return { fail: { ok: false, reason: 'network' } }; }
}

/** listTakeout({ wakeUrl, req, key, run }) → { ok: true, exports } | { ok: false, reason }. */
export async function listTakeout(o = {}) {
  const { url, req, key, run } = args(o);
  const r = await call(run, url, { req, key, op: 'list' });
  if (r.fail) return r.fail;
  const no = refusal(r.answer);
  if (no) return no;
  const exports = r.answer && r.answer.ok === true ? cleanExports(r.answer.exports) : null;
  return exports ? { ok: true, exports } : { ok: false, reason: 'bad_answer' };
}

/**
 * fetchTakeout({ wakeUrl, req, key, out, newerThan?, run? }) — the newest export's parts into `out` (made when missing),
 * each under its own Drive name and checked against its listed size.
 * → { ok: true, stamp, created, files: [paths], bytes } · { ok: true, none: true, reason: 'no_export' }
 *   · { ok: true, none: true, reason: 'not_newer', newest } (its stamp is not after newerThan)
 *   · { ok: false, reason, newest? } — too_large (newest flagged), the core's refusal reason, not_deployed (a core without
 *     the route), bad_answer (anything unparsable), size_mismatch, network (run threw). A failure part-way removes the
 *     parts this call wrote. Bad arguments throw.
 */
export async function fetchTakeout(o = {}) {
  const { url, req, key, run } = args(o);
  const listed = await listTakeout({ ...o, run });
  if (!listed.ok) return listed;
  const newest = listed.exports[0];
  if (!newest) return { ok: true, none: true, reason: 'no_export' };
  if (o.newerThan && !(newest.stamp > String(o.newerThan).toUpperCase())) return { ok: true, none: true, reason: 'not_newer', newest: newest.stamp };
  if (newest.too_large) return { ok: false, reason: 'too_large', newest: newest.stamp };
  if (!o.out) throw new Error('out must name a directory');
  fs.mkdirSync(o.out, { recursive: true });
  const files = [];
  const fail = (res) => { for (const f of files) fs.rmSync(f, { force: true }); return res; };
  let bytes = 0;
  for (const p of newest.parts) {
    const r = await call(run, url, { req, key, op: 'get', name: p.name });
    if (r.fail) return fail(r.fail);
    const no = refusal(r.answer);
    if (no) return fail(no);
    const a = r.answer;
    if (!a || typeof a !== 'object' || a.ok !== true || a.name !== p.name || typeof a.data !== 'string' || !Number.isInteger(a.bytes)) return fail({ ok: false, reason: 'bad_answer' });
    const buf = Buffer.from(a.data, 'base64');
    if (buf.length !== p.bytes || a.bytes !== p.bytes) return fail({ ok: false, reason: 'size_mismatch' });
    const file = path.join(o.out, p.name);
    fs.writeFileSync(file, buf);
    files.push(file);
    bytes += buf.length;
  }
  return { ok: true, stamp: newest.stamp, created: newest.created, files, bytes };
}

function parse(argv) {
  const o = {}, flags = { '--wake-url': 'wake_url', '--key-from': 'key_from', '--out': 'out', '--newer-than': 'newer_than' };
  for (let i = 0; i < argv.length; i++) {
    if (flags[argv[i]]) { if (i + 1 >= argv.length) throw new Error('missing value for ' + argv[i]); o[flags[argv[i]]] = argv[++i]; }
    else if (argv[i] === '--list') o.list = true;
    else throw new Error('unknown argument' + (/^--[a-z-]{1,30}$/.test(String(argv[i])) ? ' ' + argv[i] : ''));   // never echo a value: it might be a key
  }
  for (const k of ['wake_url', 'key_from'].concat(o.list ? [] : ['out'])) if (!o[k]) throw new Error('missing --' + k.replace('_', '-'));
  return o;
}

/** The CLI: → [exit code, the one JSON object to print]. */
export async function main(argv) {
  const o = parse(argv);
  const { req, key } = keyFrom(o.key_from);
  const base = { wakeUrl: o.wake_url, req, key };
  if (o.list) { const r = await listTakeout(base); return [r.ok ? 0 : 1, r]; }
  const r = await fetchTakeout({ ...base, out: o.out, newerThan: o.newer_than });
  return [r.ok ? (r.none ? 2 : 0) : 1, r];
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    ([code, r]) => { console.log(JSON.stringify(r)); process.exit(code); },
    (e) => { console.log(JSON.stringify({ ok: false, reason: String((e && e.message) || e).slice(0, 200) })); process.exit(1); }
  );
}

// Developed by: LightAISolutions
