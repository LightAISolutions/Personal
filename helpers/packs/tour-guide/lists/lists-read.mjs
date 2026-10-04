/**
 * Tour Guide — Lists: the Takeout "Saved" reader (TG-PHASE-14 WP-14d). Pure: bytes in, lists out; no file system, no
 * network, no clock. The only dependency is node:zlib.
 *
 *   readSavedExport(bytes, { file, limits? }) → { lists: [{ name, items: [{ title, url, note, address }], truncated? }],
 *                                                  skipped: [{ file, reason }], partial }
 *   readSavedExports([{ bytes, file }], { limits? }) → the same shape, for one export Takeout split into parts (WP-14f)
 *   parseCsv(text) → string[][]   (RFC 4180)
 *
 * A .tgz (gunzip, then the tar blocks), a .zip (the central directory; stored and deflated entries) or a bare .csv. In
 * an archive every .csv under a `Saved/` folder is read, and any other .csv whose header has Title and URL (Takeout names
 * its folders in the account's language); everything else is skipped without being inflated. Each CSV is one list,
 * named after its file. `partial` is true when the export was not read whole (a limit, a damaged archive, a Saved CSV
 * without Title and URL): the merge then never untags a place from a list it did not see.
 */
import zlib from 'node:zlib';

/** The reader's limits (the brief's numbers). `limits` in the options overrides any of them (the tests use small ones). */
export const LIMITS = Object.freeze({ lists: 100, items_per_list: 2000, items: 10000, bytes: 50 * 1024 * 1024 });
const UTF8 = new TextDecoder('utf-8');

/* ==================== CSV ==================== */

/** RFC 4180: quoted fields, doubled quotes, embedded commas and newlines, CRLF or LF line ends, a leading BOM. */
export function parseCsv(text) {
  const s = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', i = 0, quoted = false, any = false;
  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { quoted = true; any = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; any = true; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; any = false;
      i += c === '\r' && s[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += c; any = true; i++;
  }
  if (any || field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** The columns of a header row, found by name without case: Title and URL are required. */
function columns(header) {
  const at = {};
  (header || []).forEach((h, i) => {
    const k = String(h).trim().toLowerCase();
    if (!(k in at)) at[k] = i;
  });
  return { title: at.title, url: at.url, note: at.note, comment: at.comment, address: at.address };
}
const hasTitleUrl = (cols) => cols.title !== undefined && cols.url !== undefined;

/** One CSV → { items } or { error }. */
function csvItems(text, max) {
  const rows = parseCsv(text);
  const cols = columns(rows[0]);
  if (!hasTitleUrl(cols)) return { error: 'no Title and URL columns' };
  const cell = (r, i) => (i === undefined || r[i] === undefined ? '' : String(r[i]).trim());
  const items = [];
  let truncated = false;
  for (const r of rows.slice(1)) {
    const title = cell(r, cols.title), url = cell(r, cols.url);
    if (!title && !url) continue;                                     // a blank row (Takeout writes one after the header)
    if (items.length >= max) { truncated = true; break; }
    const note = [cell(r, cols.note), cell(r, cols.comment)].filter(Boolean).join(' — ');
    items.push({ title, url, note, address: cell(r, cols.address) });
  }
  return { items, truncated };
}

/* ==================== archives ==================== */

const isCsv = (name) => /\.csv$/i.test(name);
const underSaved = (name) => String(name).split('/').slice(0, -1).some((seg) => seg.toLowerCase() === 'saved');
const listName = (name) => String(name).split('/').pop().replace(/\.csv$/i, '');
const octal = (b, at, len) => parseInt(b.subarray(at, at + len).toString('latin1').replace(/[\0 ]+$/g, '').trim() || '0', 8);

/** The tar blocks of an unpacked buffer → [{ name, data }] for regular files (ustar prefix, pax `path`, GNU long names). */
function untar(buf) {
  const out = [];
  let off = 0, longName = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const size = octal(h, 124, 12);
    const type = String.fromCharCode(h[156] || 48);
    const start = off + 512, end = start + size;
    if (!Number.isFinite(size) || size < 0 || end > buf.length) break;   // cut short (a limit) or damaged: stop here
    const data = buf.subarray(start, end);
    off = start + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(UTF8.decode(data));
      if (m) longName = m[1];
      continue;
    }
    if (type === 'L') { longName = UTF8.decode(data).replace(/\0+$/, ''); continue; }
    if (type === 'g') continue;
    let name = UTF8.decode(h.subarray(0, 100)).replace(/\0.*$/s, '');
    const prefix = h.subarray(257, 262).toString('latin1') === 'ustar' ? UTF8.decode(h.subarray(345, 500)).replace(/\0.*$/s, '') : '';
    if (prefix) name = prefix + '/' + name;
    if (longName) { name = longName; longName = null; }
    if (type === '0' || type === '\0' || type === '7') out.push({ name, data });
  }
  return out;
}

/** gunzip within the byte limit; past it, the longest prefix that fits (so whole entries before it still read). */
function gunzipBounded(buf, max) {
  try { return { data: zlib.gunzipSync(buf, { maxOutputLength: max }), over: false }; } catch (e) {
    if (!(e instanceof RangeError)) {
      try { return { data: zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: max }), over: false, damaged: true }; } catch (e2) {
        if (!(e2 instanceof RangeError)) return { data: null, over: false, damaged: true };
      }
    }
  }
  for (let n = Math.floor(buf.length / 2); n > 0; n = Math.floor(n / 2)) {
    try { return { data: zlib.gunzipSync(buf.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: max }), over: true }; } catch (e) { /* try a shorter prefix */ }
  }
  return { data: Buffer.alloc(0), over: true };
}

/** The zip's central directory → [{ name, method, flags, csize, usize, offset, crc }] or null when there is none. */
function zipDirectory(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  let count = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  if ((count === 0xffff || cdOff === 0xffffffff) && eocd >= 20 && buf.readUInt32LE(eocd - 20) === 0x07064b50) {   // ZIP64
    const rec = Number(buf.readBigUInt64LE(eocd - 12));
    if (rec + 56 <= buf.length && buf.readUInt32LE(rec) === 0x06064b50) { count = Number(buf.readBigUInt64LE(rec + 32)); cdOff = Number(buf.readBigUInt64LE(rec + 48)); }
  }
  const out = [];
  let p = cdOff;
  for (let k = 0; k < count && p + 46 <= buf.length; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return out.length ? out : null;
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const e = { flags: buf.readUInt16LE(p + 8), method: buf.readUInt16LE(p + 10), crc: buf.readUInt32LE(p + 16),
      csize: buf.readUInt32LE(p + 20), usize: buf.readUInt32LE(p + 24), offset: buf.readUInt32LE(p + 42),
      name: UTF8.decode(buf.subarray(p + 46, p + 46 + nlen)) };
    let x = p + 46 + nlen;
    const xend = x + xlen;
    while (x + 4 <= xend) {                                            // the ZIP64 extra field, when the sizes overflowed
      const id = buf.readUInt16LE(x), len = buf.readUInt16LE(x + 2);
      if (id === 1) {
        let q = x + 4;
        if (e.usize === 0xffffffff) { e.usize = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (e.csize === 0xffffffff) { e.csize = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (e.offset === 0xffffffff) { e.offset = Number(buf.readBigUInt64LE(q)); }
      }
      x += 4 + len;
    }
    out.push(e);
    p = xend + clen;
  }
  return out;
}
function zipData(buf, e, max) {
  const o = e.offset;
  if (o + 30 > buf.length || buf.readUInt32LE(o) !== 0x04034b50) throw new Error('damaged entry');
  const start = o + 30 + buf.readUInt16LE(o + 26) + buf.readUInt16LE(o + 28);
  const raw = buf.subarray(start, start + e.csize);
  if (raw.length !== e.csize) throw new Error('damaged entry');
  const data = e.method === 0 ? raw : zlib.inflateRawSync(raw, { maxOutputLength: Math.max(1, max) });
  if (typeof zlib.crc32 === 'function' && (zlib.crc32(data) >>> 0) !== (e.crc >>> 0)) throw new Error('damaged entry (checksum)');
  return data;
}

/* ==================== the export ==================== */

/**
 * readSavedExport(bytes, { file, limits }) — see the header. `file` names a bare CSV (the list's name) and the archive in
 * `skipped`. The format is read from the bytes (gzip, zip), else from the name; anything else is treated as one CSV.
 */
export function readSavedExport(bytes, opts = {}) {
  const st = readState(opts);
  readInto(st, bytes, String(opts.file || 'export'));
  return readDone(st);
}

/**
 * readSavedExports(parts, { limits }) — one export that Takeout split into parts ([{ bytes, file }], in part order) →
 * the same shape as readSavedExport. A list merges into the list of the same name read from an earlier part (its items
 * appended in part order, `truncated` when any part's list was); within one part lists behave exactly as in
 * readSavedExport, so one part gives exactly its result. The lists, items-in-all and items-in-a-list limits hold for the
 * whole export (a merged list counts once against `lists`); the unpacked-size limit holds for each part. Once the lists
 * or items-in-all limit is reached, later parts are not read and are named in `skipped`. `skipped` is concatenated and
 * `partial` is true when any part was partial.
 */
export function readSavedExports(parts, opts = {}) {
  const st = readState(opts);
  for (const p of Array.isArray(parts) ? parts : []) {
    const file = String((p && p.file) || 'export');
    if (st.stopped) { st.skip(file, `${st.stopped}: not read`, true); continue; }
    readInto(st, p ? p.bytes : null, file);
    st.prior = new Map();
    for (const l of st.res.lists) if (!st.prior.has(l.name)) st.prior.set(l.name, l);
  }
  return readDone(st);
}

/** The state a read accumulates in: the result, the limits, the items read, why reading stopped, earlier parts' lists. */
function readState(opts) {
  const res = { lists: [], skipped: [], partial: false };
  return { res, lim: { ...LIMITS, ...(opts.limits || {}) }, total: 0, stopped: '', prior: null,
    skip: (f, reason, partial) => { res.skipped.push({ file: f, reason }); if (partial) res.partial = true; } };
}
function readDone(st) {
  st.res.lists.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return st.res;
}

/** Read one archive (or bare CSV) into the state. The lists and items-in-all limits stop the whole read; the size limit this part. */
function readInto(st, bytes, file) {
  const { res, lim, skip } = st;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes instanceof Uint8Array ? bytes : String(bytes ?? ''));
  let partStopped = false;
  const halted = () => partStopped || !!st.stopped;

  const take = (name, text, inSaved) => {
    if (halted()) return;
    const into = st.prior && st.prior.has(listName(name)) ? st.prior.get(listName(name)) : null;
    if (!into && res.lists.length >= lim.lists) { skip(name, `over the limit of ${lim.lists} lists: not read`, true); st.stopped = `over the limit of ${lim.lists} lists`; return; }
    const left = lim.items - st.total, room = lim.items_per_list - (into ? into.items.length : 0);
    const r = csvItems(text, Math.max(0, Math.min(room, left)));
    if (r.error) { skip(name, inSaved ? r.error : `not a saved list (${r.error})`, inSaved); return; }
    const list = into || { name: listName(name), items: [] };
    for (const it of r.items) list.items.push(it);
    st.total += r.items.length;
    if (r.truncated) {
      list.truncated = true;
      res.partial = true;
      skip(name, left <= room && r.items.length === left
        ? `over the limit of ${lim.items} items in all: ${r.items.length} read from this list, the rest not read`
        : `over the limit of ${lim.items_per_list} items in a list: the first ${list.items.length} read`, true);
      if (st.total >= lim.items) st.stopped = `over the limit of ${lim.items} items in all`;
    }
    if (!into) res.lists.push(list);
  };

  const gz = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const pk = buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (gz || /\.(tgz|tar\.gz)$/i.test(file)) {
    const u = gunzipBounded(buf, lim.bytes);
    if (!u.data) { skip(file, 'not a readable .tgz archive', true); return; }
    if (u.damaged) skip(file, 'the archive is damaged: what could be read was read', true);
    if (u.over) skip(file, `over the limit of ${Math.round(lim.bytes / 1048576 * 100) / 100} MB unpacked: the rest not read`, true);
    for (const e of untar(u.data)) {
      if (!isCsv(e.name)) { skip(e.name, 'not a CSV'); continue; }
      take(e.name, UTF8.decode(e.data), underSaved(e.name));
    }
  } else if (pk || /\.zip$/i.test(file)) {
    const dir = zipDirectory(buf);
    if (!dir) { skip(file, 'not a readable .zip archive', true); return; }
    let unpacked = 0;
    for (const e of dir) {
      if (e.name.endsWith('/')) continue;
      if (!isCsv(e.name)) { skip(e.name, 'not a CSV'); continue; }
      const inSaved = underSaved(e.name);
      if (halted()) break;
      if (e.flags & 1) { skip(e.name, 'encrypted: not read', inSaved); continue; }
      if (e.method !== 0 && e.method !== 8) { skip(e.name, `compression method ${e.method} not supported`, inSaved); continue; }
      if (unpacked + e.usize > lim.bytes) { skip(e.name, `over the limit of ${Math.round(lim.bytes / 1048576 * 100) / 100} MB unpacked: not read`, true); partStopped = true; break; }
      let data;
      try { data = zipData(buf, e, lim.bytes - unpacked); } catch (err) { skip(e.name, err instanceof RangeError ? 'over the unpacked limit: not read' : String(err.message || 'damaged entry'), true); continue; }
      unpacked += data.length;
      take(e.name, UTF8.decode(data), inSaved);
    }
  } else {
    if (buf.length > lim.bytes) { skip(file, `over the limit of ${Math.round(lim.bytes / 1048576 * 100) / 100} MB unpacked: not read`, true); return; }
    take(file.split(/[\\/]/).pop(), UTF8.decode(buf), true);
  }
}

// Developed by: LightAISolutions
