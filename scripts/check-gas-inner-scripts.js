#!/usr/bin/env node
/**
 * check-gas-inner-scripts.js
 *
 * Validates the JavaScript inside the <script> blocks that each Google Apps
 * Script project SERVES to the browser. A .gs file builds its served page as a
 * STRING inside a JS template literal (var html = `...`). Running `node --check`
 * on the .gs validates the OUTER wrapper but NOT the inner script's own syntax —
 * an unclosed brace / IIFE inside that served <script> is invisible to the
 * wrapper check, yet at runtime it kills the entire served script (including the
 * auth-init code), so fresh sign-ins hang while already-open tabs keep working.
 *
 * For every googleAppsScripts/<Project>/<name>.gs this checker covers BOTH ways a
 * served page is assembled:
 *   Pass 1 — TEMPLATE LITERALS (var html = `...`): scans top-level template
 *     literals, neutralizes their ${...} interpolations, and evaluates each as a
 *     template literal so Node undoes the .gs-level escaping → runtime served HTML.
 *   Pass 2 — STRING CONCATENATION ('...<script>' + 'code' + JSON.stringify(x) +
 *     '...</script>'): lexes the source; when a quoted string's cooked value
 *     contains "<script", walks its `+` chain — cooking string/template pieces and
 *     substituting `0` for injected expressions — to reconstruct the served HTML.
 * Then for each rendered HTML it extracts every inline <script> block (skipping
 * external src= and non-JS types) and runs `node --check` on the block's JS.
 *
 * Exit 0 = all inner scripts parse. Exit 1 = at least one inner syntax error.
 *
 * If a file contains "<script" markers that neither pass can reconstruct (an
 * unrecognized construction), the tool reports an explicit coverage note (not a
 * failure) so "0 OK" never silently hides un-analyzed scripts.
 *
 * Usage:
 *   node scripts/check-gas-inner-scripts.js                 # all .gs under googleAppsScripts/
 *   node scripts/check-gas-inner-scripts.js a.gs b.gs ...   # specific files
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

// --- low-level scanners (string / template / brace aware) ---
function skipStr(s, i, q) {
  i++;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === q) return i + 1;
    i++;
  }
  return i;
}

function skipTpl(s, i) {
  i++;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && s[i + 1] === '{') { i = matchBrace(s, i + 1); continue; }
    i++;
  }
  return i;
}

function matchBrace(s, start) {
  let d = 0, i = start;
  while (i < s.length) {
    const c = s[i];
    if (c === '{') { d++; i++; }
    else if (c === '}') { d--; i++; if (d === 0) return i; }
    else if (c === '`') i = skipTpl(s, i);
    else if (c === '"' || c === "'") i = skipStr(s, i, c);
    else i++;
  }
  return s.length;
}

// Capture the raw body of the template literal whose backtick is at s[i].
function captureTemplate(s, i) {
  i++;
  let body = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { body += s[i] + (s[i + 1] || ''); i += 2; continue; }
    if (c === '`') return { body, end: i + 1 };
    if (c === '$' && s[i + 1] === '{') { const j = matchBrace(s, i + 1); body += s.slice(i, j); i = j; continue; }
    body += c; i++;
  }
  return { body, end: i };
}

// Collect the raw bodies of all top-level template literals in the source,
// skipping over line/block comments and ordinary string literals.
function findTemplateLiterals(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { i += 2; while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") { i = skipStr(s, i, c); continue; }
    if (c === '`') { const r = captureTemplate(s, i); out.push(r.body); i = r.end; continue; }
    i++;
  }
  return out;
}

// Replace every ${...} interpolation with a neutral literal (0) so the body can
// be evaluated as a static template literal.
function neutralizeInterps(body) {
  let out = '', i = 0;
  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') { const j = matchBrace(body, i + 1); out += '0'; i = j; }
    else { out += body[i]; i++; }
  }
  return out;
}

// Extract inline <script> blocks from runtime HTML. Skips external (src=) and
// non-JS type blocks (application/json, text/template, etc.).
function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '', code = m[2] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const tm = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = tm ? tm[1].toLowerCase() : '';
    const isModule = type === 'module';
    if (type && type !== 'text/javascript' && type !== 'application/javascript' && !isModule) continue;
    if (!code.trim()) continue;
    blocks.push({ code, isModule });
  }
  return blocks;
}

// Cook a string literal whose opening quote is at s[i]. Returns {value, end}.
function cookString(s, i) {
  const q = s[i], end = skipStr(s, i, q);
  let value = '';
  try { value = eval(s.slice(i, end)); } catch (_) {}
  return { value: String(value), end };
}

// Cook a template literal at s[i] (interpolations neutralized). Returns {value, end}.
function cookTemplate(s, i) {
  const { body, end } = captureTemplate(s, i);
  let value = '';
  try { value = eval('`' + neutralizeInterps(body) + '`'); } catch (_) {}
  return { value: String(value), end };
}

// Advance past a non-string concat operand (e.g. JSON.stringify(x), a variable,
// a call) — stops at the next top-level `+` or a chain terminator (`;` `,` or a
// closing bracket that ends the enclosing context).
function readOperandEnd(s, i) {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '`') { i = skipTpl(s, i); continue; }
    if (c === '"' || c === "'") { i = skipStr(s, i, c); continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue; }
    if (c === ')' || c === ']' || c === '}') { if (depth === 0) return i; depth--; i++; continue; }
    if (depth === 0 && (c === '+' || c === ';' || c === ',')) return i;
    i++;
  }
  return i;
}

// Skip whitespace and comments; return the next significant index.
function skipTrivia(s, i) {
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    break;
  }
  return i;
}

// Some served pages assemble their HTML by STRING CONCATENATION
// ('...<script>' + 'code' + JSON.stringify(x) + '...</script>') rather than a
// template literal. This lexes the source at top level; when a quoted string's
// cooked value contains "<script", it walks that `+` concatenation chain —
// cooking string/template pieces and substituting `0` for injected expressions —
// to reconstruct the served HTML, then returns each rendered fragment.
function extractConcatRenders(s) {
  const renders = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { i += 2; while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '`') { i = skipTpl(s, i); continue; } // template literals handled elsewhere
    if (c === '"' || c === "'") {
      const start = cookString(s, i);
      if (start.value.indexOf('<script') >= 0) {
        let rendered = start.value, j = start.end;
        // Walk the `+` concatenation chain forward.
        while (true) {
          let k = skipTrivia(s, j);
          if (s[k] !== '+') break;          // chain ended
          k = skipTrivia(s, k + 1);
          const oc = s[k];
          if (oc === '"' || oc === "'") { const p = cookString(s, k); rendered += p.value; j = p.end; }
          else if (oc === '`') { const p = cookTemplate(s, k); rendered += p.value; j = p.end; }
          else { rendered += '0'; j = readOperandEnd(s, k); }
        }
        renders.push(rendered);
      }
      i = start.end;
      continue;
    }
    i++;
  }
  return renders;
}

// --- per-file check ---
function checkFile(file, tmpDir) {
  const src = fs.readFileSync(file, 'utf8');
  const rawScriptTags = (src.match(/<script\b/gi) || []).length;
  const templates = findTemplateLiterals(src);
  const errors = [], warnings = [];
  let scriptCount = 0;
  templates.forEach((body, ti) => {
    if (body.indexOf('<script') < 0) return;
    let runtime;
    try { runtime = eval('`' + neutralizeInterps(body) + '`'); }
    catch (e) { warnings.push('template #' + ti + ' could not be expanded (' + String(e.message).slice(0, 120) + ')'); return; }
    checkBlocks(runtime, 'tpl#' + ti, file, tmpDir, errors, () => scriptCount++);
  });
  // Pass 2 — string-concatenation-built served pages.
  extractConcatRenders(src).forEach((render, ci) => {
    checkBlocks(render, 'concat#' + ci, file, tmpDir, errors, () => scriptCount++);
  });
  return { file, scriptCount, rawScriptTags, errors, warnings };
}

// Extract <script> blocks from a rendered HTML string and node --check each.
function checkBlocks(html, where, file, tmpDir, errors, onCount) {
  extractScriptBlocks(html).forEach((blk, bi) => {
    onCount();
    const safe = where.replace(/[^a-z0-9]/gi, '_');
    const tmp = path.join(tmpDir, path.basename(file) + '.' + safe + '.s' + bi + (blk.isModule ? '.mjs' : '.js'));
    fs.writeFileSync(tmp, blk.code);
    const r = cp.spawnSync('node', ['--check', tmp], { encoding: 'utf8' });
    if (r.status !== 0) {
      errors.push({ where: where + ', <script> #' + bi, detail: (r.stderr || '').split('\n').slice(0, 5).join('\n') });
    }
    try { fs.unlinkSync(tmp); } catch (_) {}
  });
}

// --- file discovery ---
function listGsFiles() {
  const root = 'googleAppsScripts';
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const dir of fs.readdirSync(root)) {
    const full = path.join(root, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.endsWith('.gs')) out.push(path.join(full, f));
    }
  }
  return out.sort();
}

// --- main ---
(function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const files = args.length ? args : listGsFiles();
  if (!files.length) { console.log('No .gs files to check.'); process.exit(0); }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-inner-'));
  let totalScripts = 0, notAnalyzed = 0;
  const failingFiles = [];
  for (const file of files) {
    let res;
    try { res = checkFile(file, tmpDir); }
    catch (e) { console.log('✗ ' + file + ' — checker error: ' + e.message); failingFiles.push(file); continue; }
    totalScripts += res.scriptCount;
    res.warnings.forEach(w => console.log('  ⚠ ' + file + ': ' + w));
    if (res.errors.length) {
      failingFiles.push(file);
      console.log('✗ ' + file + ' — ' + res.errors.length + ' inner <script> syntax error(s)');
      res.errors.forEach(er => {
        console.log('    [' + er.where + ']');
        er.detail.split('\n').forEach(l => console.log('      ' + l));
      });
    } else {
      console.log('✓ ' + file + ' — ' + res.scriptCount + ' inner <script> block(s) OK');
      // Honest coverage note: both template-literal and string-concatenation
      // construction are checked. If a file has "<script" markers but neither pass
      // could reconstruct any block, surface it rather than implying "0 = clean".
      if (res.scriptCount === 0 && res.rawScriptTags > 0) {
        notAnalyzed += res.rawScriptTags;
        console.log('  ⚠ ' + file + ': ' + res.rawScriptTags + " '<script' tag(s) present but no block could be reconstructed (unrecognized construction) — NOT validated by this tool.");
      }
    }
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  console.log('\nChecked ' + files.length + ' file(s), ' + totalScripts + ' inner <script> block(s).');
  if (notAnalyzed) {
    console.log('Note: ' + notAnalyzed + ' served <script> tag(s) use a construction this tool does not parse (not a failure).');
  }
  if (failingFiles.length) {
    console.log('FAILED: ' + failingFiles.length + ' file(s) with inner <script> syntax errors.');
    process.exit(1);
  }
  console.log('All inner <script> blocks parse cleanly.');
  process.exit(0);
})();

// Developed by: LightAISolutions
