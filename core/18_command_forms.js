/**
 * Helpers core — command form templates: how a pack describes a command's forms so the app can draw a form for each and
 * run it (runOwnerCommand, 10_router.js). One grammar for every helper:
 *   literal text · {name} a required field · [ … ] an optional segment, dropped whole when a field inside it is empty.
 *   e.g. '/late {min}[ {day}]', '/daytrip[ from {from}][ under {under} min][ on {date}]'. No nesting; names ^[a-z][a-z0-9_]*$.
 * Field kinds (the shell draws a picker for each; the value is always text inserted as is):
 *   trip (a trip's slug) · day (a day of the current trip, as YYYY-MM-DD) · date (YYYY-MM-DD) · place (a place name) ·
 *   list (a saved list's name) · number (min, max, chips) · choice (options, or `from` a list the pack's context gives) ·
 *   time (HH:MM) · text (max_len, chips).
 * HB_FIELD_KINDS also holds, per kind, the pattern an example of that kind matches, so a pack's test can prove every example
 * it shows fills its own template (examples and forms cannot drift apart).
 */
var HB_FIELD_KINDS = {
  trip: '.+?', day: '(?:day ?\\d{1,2}|\\d{1,2}|\\d{4}-\\d{2}-\\d{2}|today|tomorrow)',
  date: '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}|today|tomorrow)', place: '.+?', list: '.+?', number: '\\d{1,4}',
  choice: '\\S+', time: '\\d{1,2}:\\d{2}', text: '.+?'
};
/** → { ok: true, parts: [{ t } | { f } | { opt: [{ t } | { f }] }], names: [field names in order] } | { ok: false, error } */
function cmdTemplateParse(tpl) {
  var s = String(tpl === undefined || tpl === null ? '' : tpl), parts = [], names = [], cur = parts, inOpt = false, i = 0;
  var push = function (p) { if (p.t !== undefined && cur.length && cur[cur.length - 1].t !== undefined) cur[cur.length - 1].t += p.t; else cur.push(p); };
  while (i < s.length) {
    var c = s.charAt(i);
    if (c === '[') {
      if (inOpt) return { ok: false, error: 'nested [ at ' + i };
      var group = { opt: [] }; parts.push(group); cur = group.opt; inOpt = true; i++; continue;
    }
    if (c === ']') {
      if (!inOpt) return { ok: false, error: 'stray ] at ' + i };
      if (!cur.some(function (p) { return p.f; })) return { ok: false, error: 'optional segment without a field at ' + i };
      cur = parts; inOpt = false; i++; continue;
    }
    if (c === '{') {
      var m = /^\{([a-z][a-z0-9_]*)\}/.exec(s.slice(i));
      if (!m) return { ok: false, error: 'bad field at ' + i };
      if (names.indexOf(m[1]) >= 0) return { ok: false, error: 'field {' + m[1] + '} twice' };
      names.push(m[1]); push({ f: m[1] }); i += m[0].length; continue;
    }
    if (c === '}') return { ok: false, error: 'stray } at ' + i };
    push({ t: c }); i++;
  }
  if (inOpt) return { ok: false, error: 'unclosed [' };
  if (!parts.length || parts[0].t === undefined || !/^\/[a-zA-Z0-9_]+/.test(parts[0].t)) return { ok: false, error: 'must start with the command' };
  return { ok: true, parts: parts, names: names };
}
/** The command a filled template sends: values { name: text }; null when a required field is empty. */
function cmdTemplateFill(parts, values) {
  var v = values || {}, val = function (n) { return String(v[n] === undefined || v[n] === null ? '' : v[n]).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var out = '', missing = false;
  parts.forEach(function (p) {
    if (p.t !== undefined) { out += p.t; return; }
    if (p.f) { var x = val(p.f); if (!x) missing = true; out += x; return; }
    var seg = '', empty = false;
    p.opt.forEach(function (q) { if (q.t !== undefined) seg += q.t; else { var y = val(q.f); if (!y) empty = true; seg += y; } });
    if (!empty) out += seg;
  });
  return missing ? null : out.replace(/\s+/g, ' ').trim();
}
/** Does `text` read as this template filled in? fields { name: { kind, options? } }; unknown kinds match any text. */
function cmdTemplateMatches(parts, fields, text) {
  var esc = function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var pat = function (n) {
    var f = (fields || {})[n] || {};
    if (f.kind === 'choice' && Array.isArray(f.options) && f.options.length) return '(?:' + f.options.map(function (o) { return esc(String(isPlainObject(o) ? o.value : o)); }).join('|') + ')';
    return '(' + (HB_FIELD_KINDS[f.kind] || '.+?') + ')';
  };
  var piece = function (p) { return p.t !== undefined ? esc(p.t) : pat(p.f); };
  var re = parts.map(function (p) { return p.opt ? '(?:' + p.opt.map(piece).join('') + ')?' : piece(p); }).join('');
  return new RegExp('^' + re + '$', 'i').test(String(text || '').replace(/\s+/g, ' ').trim());
}

// Developed by: LightAISolutions
