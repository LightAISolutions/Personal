#!/usr/bin/env node
// Routine helper: put one file a routine made (a PDF, an HTML page) into the helper's Drive folder through the core's
// ?route=upload, and print the Drive file id to name in a `reply` envelope's drive_file_ids (the core then sends the
// file to the chat). The Drive connector cannot carry megabytes of base64; this POSTs the bytes directly. Zero deps;
// uses curl so the environment's proxy settings apply (Apps Script answers a POST with a 302 that curl -L follows).
//   node helpers/tools/upload.mjs --wake-url <state.json wake_url> --req <request id> --key <req payload.upload_key>
//        --file <path> [--name NAME] [--folder trips/<slug>] [--dry-run]
// Prints {"ok":true,"file_id","url","name","bytes"} or {"ok":false,"reason"}; exit 0 / 1. Never log the key.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MIMES = { pdf: 'application/pdf', html: 'text/html' };
export const MAX_BYTES = 30 * 1024 * 1024;   // mirrors LIMITS.UPLOAD_MAX_BYTES in core/00_config.js

/** uploadUrl('https://script.google.com/macros/s/X/exec?route=wake') → '…/exec?route=upload'. */
export function uploadUrl(wakeUrl) {
  const u = new URL(String(wakeUrl || ''));
  if (u.protocol !== 'https:') throw new Error('wake url must be https');
  u.search = '';
  u.searchParams.set('route', 'upload');
  return u.toString();
}

/** uploadBody({req, key, file, name?, folder?}) → { body, name, mime, bytes } — validates what the core would refuse. */
export function uploadBody(o) {
  const name = o.name || path.basename(o.file);
  const ext = name.split('.').pop().toLowerCase();
  if (!MIMES[ext]) throw new Error('only .pdf and .html files can be uploaded');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name)) throw new Error('name must be letters, digits, . _ - (≤ 100)');
  if (o.folder && !/^[a-z0-9][a-z0-9-]{0,63}(\/[a-z0-9][a-z0-9-]{0,63}){0,2}$/.test(o.folder)) throw new Error('folder must be ≤ 3 lowercase parts, e.g. trips/kyoto');
  if (!/^(req_)?[0-9a-f-]{36}$/i.test(String(o.req || ''))) throw new Error('--req must be the request id');
  if (!/^[0-9a-f]{64}$/.test(String(o.key || ''))) throw new Error('--key must be the request payload upload_key');
  const buf = fs.readFileSync(o.file);
  if (!buf.length) throw new Error('file is empty');
  if (buf.length > MAX_BYTES) throw new Error('file is larger than 30 MB');
  const body = { req: String(o.req).replace(/^req_/, ''), key: o.key, name, mime: MIMES[ext], data: buf.toString('base64') };
  if (o.folder) body.folder = o.folder;
  return { body, name, mime: MIMES[ext], bytes: buf.length };
}

function parse(argv) {
  const o = {}, flags = { '--wake-url': 'wake_url', '--req': 'req', '--key': 'key', '--file': 'file', '--name': 'name', '--folder': 'folder' };
  for (let i = 0; i < argv.length; i++) {
    if (flags[argv[i]]) o[flags[argv[i]]] = argv[++i];
    else if (argv[i] === '--dry-run') o.dry = true;
    else throw new Error('unknown argument ' + argv[i]);
  }
  for (const k of ['wake_url', 'req', 'key', 'file']) if (!o[k]) throw new Error('missing --' + k.replace('_', '-'));
  return o;
}

async function main(argv) {
  const o = parse(argv);
  const url = uploadUrl(o.wake_url);
  const { body, name, bytes } = uploadBody(o);
  if (o.dry) return { ok: true, dry_run: true, url, name, bytes };
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'upload-')), 'body.json');
  fs.writeFileSync(tmp, JSON.stringify(body));
  try {
    const out = execFileSync('curl', ['-sSL', '--max-time', '300', '-H', 'Content-Type: text/plain', '--data-binary', '@' + tmp, url], { encoding: 'utf8', maxBuffer: 1 << 20 });
    try { return JSON.parse(out); } catch (x) { return { ok: false, reason: 'not_json', head: out.slice(0, 200) }; }
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (r) => { console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1); },
    (e) => { console.log(JSON.stringify({ ok: false, reason: e.message })); process.exit(1); }
  );
}

// Developed by: LightAISolutions
