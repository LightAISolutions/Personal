#!/usr/bin/env node
/**
 * Helpers — boundary check. The public framework repo must never carry personal data or secrets. This scans a tree and
 * fails (exit 1) on:
 *   · personal-data PATHS: profile* files, and anything inside people/ projects/ trips/ places/ log/ quarantine/ (an
 *     empty .gitkeep is allowed so templates can ship the directories),
 *   · secret / PII PATTERNS in file contents: bot tokens, API keys (Google, Anthropic, GitHub, OAuth), private keys,
 *     Apps Script deployment / script / spreadsheet ids, e-mail addresses (except allowlisted fixture domains), phone numbers,
 *     and every `deny` pattern in tools/boundary-allowlist.txt.
 * Usage: node helpers/tools/boundary-check.mjs [--root DIR] [--allowlist FILE] [--quiet] [path ...]
 * Default root: the helpers/ directory this file lives in. Matches are printed redacted (never the whole secret).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HELPERS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_ALLOWLIST = join(HELPERS_ROOT, 'tools', 'boundary-allowlist.txt');
export const PERSONAL_DIRS = ['people', 'projects', 'trips', 'places', 'log', 'quarantine'];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp3|mp4|ogg|wav)$/i;
const SKIP_DIRS = new Set(['.git', 'node_modules']);
/** [rule, regex, redact?] — content rules. Keep each regex specific; false positives block merges. */
export const PATTERNS = [
  ['telegram-bot-token', /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['anthropic-api-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ['generic-sk-key', /\bsk-[A-Za-z0-9]{32,}\b/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g],
  ['google-oauth-token', /\b(?:ya29\.[A-Za-z0-9_-]{20,}|1\/\/0[A-Za-z0-9_-]{20,})\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g],
  ['apps-script-deployment-id', /\bAKfycb[A-Za-z0-9_-]{30,}\b/g],
  ['google-script-id', /\b1[A-Za-z0-9_-]{56}\b/g],
  ['google-spreadsheet-id', /\b1[A-Za-z0-9_-]{43}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['email-address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, 'email'],
  ['phone-number', /(?<![\w.\/-])(?:\+\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?![\w-])/g]
];

export function loadAllowlist(file = DEFAULT_ALLOWLIST) {
  const al = { domains: new Set(), literals: new Set(), paths: [], deny: [] };
  if (!file || !existsSync(file)) return al;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sp = line.indexOf(' ');
    const kind = sp < 0 ? line : line.slice(0, sp), value = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (!value) continue;
    if (kind === 'domain') al.domains.add(value.toLowerCase());
    else if (kind === 'literal') al.literals.add(value);
    else if (kind === 'path') al.paths.push(value.replace(/\\/g, '/'));
    else if (kind === 'deny') al.deny.push(['deny:' + value, new RegExp(value, 'g')]);
  }
  return al;
}
export function redact(s) { s = String(s); return s.length <= 8 ? s[0] + '…' : s.slice(0, 4) + '…' + s.slice(-3) + ' (' + s.length + ' chars)'; }

/** pathProblems('templates/private-repo/log/.gitkeep') → [] ; ('people/alice.md') → ['personal-data path: people/'] */
export function pathProblems(rel) {
  const parts = rel.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  const out = [];
  if (/^profile/i.test(name)) out.push('personal-data path: profile*');
  parts.slice(0, -1).forEach((seg) => { if (PERSONAL_DIRS.includes(seg) && name !== '.gitkeep') out.push('personal-data path: ' + seg + '/'); });
  return out;
}
/** contentProblems(text, allowlist) → [{line, rule, match}] */
export function contentProblems(text, al = loadAllowlist()) {
  const out = [];
  const lines = text.split('\n');
  const rules = PATTERNS.concat(al.deny.map(([r, re]) => [r, re]));
  lines.forEach((line, i) => {
    for (const [rule, re, kind] of rules) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const hit = m[0];
        if (al.literals.has(hit)) continue;
        if (kind === 'email') { const dom = hit.slice(hit.lastIndexOf('@') + 1).toLowerCase(); if (al.domains.has(dom) || [...al.domains].some((d) => dom.endsWith('.' + d))) continue; }
        out.push({ line: i + 1, rule, match: redact(hit) });
      }
    }
  });
  return out;
}
function walk(dir, root, al, acc) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name), rel = relative(root, abs).split(sep).join('/');
    if (al.paths.some((p) => rel === p.replace(/\/$/, '') || rel.startsWith(p.endsWith('/') ? p : p + '/'))) continue;
    const st = statSync(abs);
    if (st.isDirectory()) { walk(abs, root, al, acc); continue; }
    if (!st.isFile()) continue;
    acc.push({ abs, rel });
  }
}
/** scan({root, allowlist, paths}) → {files, findings:[{path, line?, rule, match?}]} */
export function scan({ root = HELPERS_ROOT, allowlist = DEFAULT_ALLOWLIST, paths = [] } = {}) {
  const al = typeof allowlist === 'string' || !allowlist ? loadAllowlist(allowlist) : allowlist;
  const files = [];
  if (paths.length) {
    for (const p of paths) {
      const abs = resolve(root, p);
      if (!existsSync(abs)) { files.push({ abs, rel: relative(root, abs).split(sep).join('/'), missing: true }); continue; }
      if (statSync(abs).isDirectory()) walk(abs, root, al, files); else files.push({ abs, rel: relative(root, abs).split(sep).join('/') });
    }
  } else walk(root, root, al, files);
  const findings = [];
  for (const f of files) {
    if (f.missing) { findings.push({ path: f.rel, rule: 'missing path' }); continue; }
    pathProblems(f.rel).forEach((rule) => findings.push({ path: f.rel, rule }));
    if (BINARY_EXT.test(f.rel) || resolve(f.abs) === resolve(typeof allowlist === 'string' ? allowlist : DEFAULT_ALLOWLIST)) continue;
    const text = readFileSync(f.abs, 'utf8');
    if (text.includes('\u0000')) continue;
    contentProblems(text, al).forEach((p) => findings.push({ path: f.rel, line: p.line, rule: p.rule, match: p.match }));
  }
  return { files: files.length, findings };
}
export function format(r) { return r.findings.map((f) => `${f.path}${f.line ? ':' + f.line : ''}: ${f.rule}${f.match ? ': ' + f.match : ''}`).join('\n'); }

function main(argv) {
  const opt = { root: HELPERS_ROOT, allowlist: DEFAULT_ALLOWLIST, quiet: false }, paths = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') opt.root = resolve(argv[++i]);
    else if (argv[i] === '--allowlist') opt.allowlist = resolve(argv[++i]);
    else if (argv[i] === '--quiet') opt.quiet = true;
    else paths.push(argv[i]);
  }
  const r = scan({ root: opt.root, allowlist: opt.allowlist, paths });
  if (r.findings.length) { console.error(format(r)); console.error(`boundary-check: ${r.findings.length} finding(s) in ${r.files} file(s) under ${opt.root}`); return 1; }
  if (!opt.quiet) console.log(`boundary-check: clean — ${r.files} file(s) under ${opt.root}`);
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

// Developed by: LightAISolutions
