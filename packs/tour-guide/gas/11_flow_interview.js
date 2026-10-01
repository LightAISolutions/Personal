/**
 * Tour Guide pack — the preference interview (WP-5a; plan §5.1, decision 14).
 * A core flow (`interview`) driven ONLY by the generated bank TG_INTERVIEW_BANK (gas/40_interview_bank.js, from the prefs
 * kit's presets/travel.interview.json) — no question is hard-coded here. One question per message, a progress line,
 * Skip on every question; pick and scale are one tap, multi toggles then Done, text takes the owner's words.
 * At the end: one `prefs` request with payload.interview = { version: 1, answers: [{ qid, dimension, value, polarity,
 * kind }] } (the kit's shape; skipped questions write nothing) and the line "building your profile…".
 * Resumable for TG_IV_TTL_MIN (state in the Flows sheet); /interview re-asks the current question; /cancel ends it.
 */
var TG_IV_TTL_MIN = 7 * 24 * 60;
var TG_IV_TEXT_VALUES_MAX = 5;   // a text answer is split on newlines, commas and semicolons into at most this many values
var TG_IV_VALUE_MAX = 60;        // the prefs kit's VALUE_MAX (lib/vocab.mjs)

function tgIvBank() { return (typeof TG_INTERVIEW_BANK !== 'undefined' && TG_INTERVIEW_BANK && TG_INTERVIEW_BANK.sections) ? TG_INTERVIEW_BANK : { sections: [] }; }
function tgIvSections() { return tgIvBank().sections; }
function tgIvSection(id) {
  var s = tgIvSections();
  for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i];
  return null;
}
/** → { q, section } for a qid, or null when the bank no longer has it. */
function tgIvFind(qid) {
  var s = tgIvSections();
  for (var i = 0; i < s.length; i++) for (var j = 0; j < s[i].questions.length; j++) if (s[i].questions[j].qid === qid) return { q: s[i].questions[j], section: s[i] };
  return null;
}
/** Ordered qids for the whole bank, or for one section. */
function tgIvQids(sectionId) {
  var out = [];
  tgIvSections().forEach(function (s) { if (!sectionId || s.id === sectionId) s.questions.forEach(function (q) { out.push(q.qid); }); });
  return out;
}
/** Section ids for /interview <section>: matches the id or the title, case-insensitively, by prefix. */
function tgIvMatchSection(arg) {
  var a = String(arg || '').trim().toLowerCase();
  if (!a) return null;
  var s = tgIvSections(), i;
  for (i = 0; i < s.length; i++) if (s[i].id === a || String(s[i].title).toLowerCase() === a) return s[i];
  for (i = 0; i < s.length; i++) if (s[i].id.indexOf(a) === 0 || String(s[i].title).toLowerCase().indexOf(a) === 0) return s[i];
  return null;
}

function _tgIvRows(buttons, perRow) {
  var rows = [];
  for (var i = 0; i < buttons.length; i += perRow) rows.push(buttons.slice(i, i + perRow));
  return rows;
}
/** The step for state.qids[state.i] (skipping qids the bank no longer has), or the final step. */
function tgIvStep(state) {
  while (state.i < state.qids.length && !tgIvFind(state.qids[state.i])) state.i++;
  if (state.i >= state.qids.length) return tgIvFinish(state);
  var f = tgIvFind(state.qids[state.i]), q = f.q;
  var head = '<i>' + (state.i + 1) + ' of ' + state.qids.length + ' · ' + tgEscape(f.section.title) + '</i>\n<b>' + tgEscape(q.text) + '</b>';
  var kb = [], expect = 'button';
  var opts = q.options.map(function (o, k) { return { text: o.label, value: 'o' + k }; });
  if (q.kind === 'text') {
    head += '\n<i>Type your answer (separate several with commas), or tap Skip.</i>';
    expect = 'any';
  } else if (q.kind === 'multi') {
    var sel = state.sel || [];
    kb = _tgIvRows(q.options.map(function (o, k) { return { text: (sel.indexOf(k) >= 0 ? '✓ ' : '') + o.label, value: 'o' + k }; }), 2);
    head += '\n<i>Tap all that apply, then Done.</i>';
    if (sel.length) head += '\nPicked: ' + sel.map(function (k) { return tgEscape(q.options[k] ? q.options[k].label : '?'); }).join(', ');
  } else {
    kb = _tgIvRows(opts, q.kind === 'scale' ? (opts.length <= 4 ? opts.length : 3) : 2);
  }
  var last = [];
  if (q.kind === 'multi') last.push({ text: '✅ Done', value: 'done' });
  last.push({ text: '⏭ Skip', value: 'skip' });
  kb.push(last);
  return { prompt: head, keyboard: kb, expect: expect, state: state };
}
/** Split a text answer into the kit's values: one line each, newline/comma/semicolon separated, ≤ 5, each ≤ 60 chars. */
function tgIvTextValues(text) {
  return String(text || '').split(/[\n,;]+/).map(function (v) { return v.replace(/\s+/g, ' ').trim(); })
    .filter(function (v) { return !!v; }).slice(0, TG_IV_TEXT_VALUES_MAX)
    .map(function (v) { return v.length > TG_IV_VALUE_MAX ? v.slice(0, TG_IV_VALUE_MAX).trim() : v; });
}
function _tgIvAnswer(q, value, polarity) { return { qid: q.qid, dimension: q.dimension, value: String(value), polarity: polarity || '+', kind: q.kind }; }

/** All answers in bank order: { version: 1, answers: [...] }. */
function tgIvAnswers(state) {
  var out = [];
  state.qids.forEach(function (qid) { (state.ans[qid] || []).forEach(function (a) { out.push(a); }); });
  return { version: 1, answers: out };
}
function tgIvFinish(state) {
  var doc = tgIvAnswers(state);
  if (!doc.answers.length) return { prompt: 'Nothing recorded — every question was skipped. Send /interview whenever you like.', done: true, state: state, result: doc };
  tgOpenKindRequest('prefs', { interview: doc }, { text: 'interview answers (' + doc.answers.length + ')' + (state.section ? ' · ' + state.section : '') });
  return { prompt: '✅ Thanks — ' + doc.answers.length + ' answer' + (doc.answers.length === 1 ? '' : 's') + ' noted. Building your profile…', done: true, state: state, result: doc };
}

registerFlow('interview', {
  ttl_min: TG_IV_TTL_MIN,
  /** seed = { section?: id } */
  start: function (seed) {
    var section = seed && seed.section ? String(seed.section) : null;
    var state = { section: section, qids: tgIvQids(section), i: 0, ans: {}, sel: [] };
    if (!state.qids.length) return { prompt: 'The question bank is empty.', done: true, state: state };
    return tgIvStep(state);
  },
  next: function (state, input) {
    var f = tgIvFind(state.qids[state.i]);
    if (input.type === 'resume' || !f) return tgIvStep(state);   // /interview again: re-ask where we are
    var q = f.q;
    if (input.type === 'text') {
      if (q.kind !== 'text') return tgIvStep(state);
      var vals = tgIvTextValues(input.text);
      if (!vals.length) return tgIvStep(state);
      state.ans[q.qid] = vals.map(function (v) { return _tgIvAnswer(q, v, '+'); });
      state.i++; state.sel = [];
      return tgIvStep(state);
    }
    var v = String(input.value || '');
    if (v === 'skip') { delete state.ans[q.qid]; state.i++; state.sel = []; return tgIvStep(state); }
    if (v === 'done' && q.kind === 'multi') {
      var sel = (state.sel || []).slice().sort(function (a, b) { return a - b; });
      if (sel.length) state.ans[q.qid] = sel.map(function (k) { return _tgIvAnswer(q, q.options[k].value, q.options[k].polarity); });
      else delete state.ans[q.qid];
      state.i++; state.sel = [];
      return tgIvStep(state);
    }
    var m = /^o(\d+)$/.exec(v), k = m ? parseInt(m[1], 10) : -1;
    if (k < 0 || !q.options[k] || q.kind === 'text') return tgIvStep(state);
    if (q.kind === 'multi') {
      state.sel = state.sel || [];
      var at = state.sel.indexOf(k);
      if (at >= 0) state.sel.splice(at, 1); else state.sel.push(k);
      return tgIvStep(state);
    }
    state.ans[q.qid] = [_tgIvAnswer(q, q.options[k].value, q.options[k].polarity)];
    state.i++; state.sel = [];
    return tgIvStep(state);
  }
});

/**
 * Start (or resume) the interview for a chat. section: a section id or '' (all). A different active flow (a /plan or
 * /review in progress) is never replaced — the owner is told to finish or /cancel it first.
 */
function tgIvStart(chatId, section) {
  var f = flowActive(chatId);
  if (f && f.flow !== 'interview') {
    tgSend(chatId, 'You are in the middle of /' + tgEscape(f.flow) + ' — finish it or send /cancel first.');
    return null;
  }
  if (f && !section) return flowResume(chatId, { type: 'resume', event: 'reprompt' });
  return flowStart(chatId, 'interview', section ? { section: section } : {});
}

registerCommand('/interview', function (ctx) {
  var arg = String(ctx.args || '').trim();
  if (!arg) return tgIvStart(ctx.chatId, '');
  if (/^(all|restart)$/i.test(arg)) { var f = flowActive(ctx.chatId); if (f && f.flow === 'interview') flowCancel(ctx.chatId); return tgIvStart(ctx.chatId, ''); }
  var s = tgIvMatchSection(arg);
  if (!s) {
    ctx.reply('No section called “' + tgEscape(truncate(arg, 40)) + '”. Sections: ' + tgIvSections().map(function (x) { return '<code>' + tgEscape(x.id) + '</code>'; }).join(', '));
    return null;
  }
  return tgIvStart(ctx.chatId, s.id);
}, 'preference interview: /interview [section] (again to resume, "all" to restart)');

// Developed by: LightAISolutions
