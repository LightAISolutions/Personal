/**
 * Tour Guide pack — handlers for the pack's six from-brain envelope types (WP-5b; contract
 * helpers/decisions/TG-PHASE-5.md §1.4, §1.5, §1.8).
 *   shortlist · trip_facts · plan_digest  → store (21_sheets.js), then hand to the active `plan` flow of the same trip
 *                                           (flowResume, event = the type), else the WP-5a renderer tg_<type>, else
 *                                           one plain line
 *   profile_summary                       → Settings + the text to the owner (escaped)
 *   prefs_review                          → one message per item with pf:<cid>:y|e|n; ✏️ captures the next free text
 *                                           (message handler tg_capture_pf_edit); a fully decided batch opens kind
 *                                           `prefs` with payload.decisions = the prefs kit's prefs_decisions document
 *   places_digest                         → Places tab; "still open / changed" lines for a places check, else one
 *                                           count line or silence
 * Each validate() is a hand-written mirror of schemas/tour-guide-<kind>.schema.json plus the semantic checks of
 * schemas/tour-guide-checks.mjs (required keys, types, enums, sizes, no unknown keys). Defaults: helpers/decisions/WP-5b.md.
 */
var TG_ENV_RE = {
  slug: /^[a-z0-9][a-z0-9-]{0,63}$/, date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, time: /^([01]\d|2[0-3]):[0-5]\d$/,
  url: /^https:\/\/\S+$/, driveId: /^[A-Za-z0-9_-]{10,200}$/, ident: /^[a-z][a-z0-9_]{0,31}$/, cid: /^c_[0-9a-f]{10}$/,
  batch: /^pfb_[0-9a-f]{16}$/, category: /^[a-z][a-z0-9-]{0,31}$/, placeId: /^[A-Za-z0-9_-]{6,300}$/,
  pfData: /^pf:c_[0-9a-f]{10}:[yen]$/,
  zoned: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/
};
var TG_ENV_DIGEST_MAX_CHARS = 60000;
var TG_ENV_MAX_ERRORS = 20;

/* ---------------- validation helpers (errs is an array of strings) ---------------- */
function tgEnvObj(errs, path, o, required, optional) {
  if (!isPlainObject(o)) { errs.push(path + ' must be an object'); return false; }
  var allowed = required.concat(optional || []);
  Object.keys(o).forEach(function (k) { if (allowed.indexOf(k) < 0) errs.push(path + ': unknown key "' + truncate(k, 40) + '"'); });
  required.forEach(function (k) { if (o[k] === undefined) errs.push(path + ': ' + k + ' required'); });
  return true;
}
function tgEnvStr(errs, path, v, min, max, re) {
  if (typeof v !== 'string') { errs.push(path + ' must be a string'); return; }
  if (v.length < min) errs.push(path + (min === 1 ? ' must not be empty' : ' too short'));
  if (v.length > max) errs.push(path + ' longer than ' + max + ' chars');
  if (re && !re.test(v)) errs.push(path + ' has the wrong format');
}
function tgEnvInt(errs, path, v, min, max) {
  if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) { errs.push(path + ' must be an integer'); return; }
  if (v < min || (max !== undefined && v > max)) errs.push(path + ' out of range');
}
function tgEnvNum(errs, path, v, min, max) {
  if (typeof v !== 'number' || !isFinite(v)) { errs.push(path + ' must be a number'); return; }
  if (v < min || v > max) errs.push(path + ' out of range');
}
function tgEnvBool(errs, path, v) { if (typeof v !== 'boolean') errs.push(path + ' must be true or false'); }
function tgEnvEnum(errs, path, v, list) { if (list.indexOf(v) < 0) errs.push(path + ' must be one of ' + list.join(' | ')); }
function tgEnvArr(errs, path, v, max, min) {
  if (!Array.isArray(v)) { errs.push(path + ' must be an array'); return false; }
  if (v.length > max) errs.push(path + ': at most ' + max + ' entries');
  if (min && v.length < min) errs.push(path + ': at least ' + min + ' entries');
  return true;
}
/** A real calendar date (2027-02-30 is refused). */
function tgEnvRealDate(s) {
  if (typeof s !== 'string' || !TG_ENV_RE.date.test(s)) return false;
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function tgEnvDate(errs, path, v) { if (!tgEnvRealDate(v)) errs.push(path + ' must be a calendar date YYYY-MM-DD'); }
function tgEnvDateOrNull(errs, path, v) { if (v !== null) tgEnvDate(errs, path, v); }
function tgEnvSlug(errs, path, v) { tgEnvStr(errs, path, v, 1, 64, TG_ENV_RE.slug); }
function tgEnvUrl(errs, path, v) { tgEnvStr(errs, path, v, 1, 2000, TG_ENV_RE.url); }
function tgEnvDupes(errs, path, arr, key, what) {
  var seen = {};
  (Array.isArray(arr) ? arr : []).forEach(function (x, i) {
    if (!isPlainObject(x) || x[key] === undefined) return;
    var k = String(x[key]);
    if (Object.prototype.hasOwnProperty.call(seen, k)) errs.push(path + '[' + i + ']: duplicate ' + (what || key) + ' ' + truncate(k, 40));
    seen[k] = true;
  });
}
/** Optional `v` (const 1) and `kind` (const) every payload schema allows. */
function tgEnvHead(errs, p, kind) {
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.kind !== undefined && p.kind !== kind) errs.push('kind must be "' + kind + '"');
}
function tgEnvSize(errs, p) { var n = toJson(p).length; if (n > TG_ENV_DIGEST_MAX_CHARS) errs.push('payload is ' + n + ' chars (max ' + TG_ENV_DIGEST_MAX_CHARS + ')'); }
function tgEnvDone(errs) { return errs.length > TG_ENV_MAX_ERRORS ? errs.slice(0, TG_ENV_MAX_ERRORS).concat(['… ' + (errs.length - TG_ENV_MAX_ERRORS) + ' more']) : errs; }

/**
 * Invisible and direction-changing characters (the core's stripHidden set: controls, bidi marks and isolates, zero-width
 * space, word joiner, BOM) could reorder or hide text in the chat (WP-6a, red-team A7), so every pack envelope is cleaned
 * in place before validation — the validators, the Sheet and the chat only ever see the cleaned strings.
 */
function tgEnvClean(v) {
  if (typeof v === 'string') return stripHidden(v);
  if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = tgEnvClean(v[i]); return v; }
  if (isPlainObject(v)) { Object.keys(v).forEach(function (k) { v[k] = tgEnvClean(v[k]); }); return v; }
  return v;
}
/** validate() wrapper: clean the payload in place (the core hands the same object to handle()), then validate it. */
function tgEnvCleaned(fn) { return function (p, env) { if (isPlainObject(p)) tgEnvClean(p); return fn(p, env); }; }

/* ---------------- validators (mirrors of the payload schemas) ---------------- */
var TG_ENV_LABELS = ['verified', 'single source', 'conflicting', 'unverified'];
var TG_ENV_OUTCOMES = ['chosen', 'later', 'skipped', 'visited'];
function tgEnvShortlistItem(errs, at, it) {
  if (!tgEnvObj(errs, at, it, ['n', 'slug', 'name', 'why_you', 'fit', 'est_minutes', 'area', 'maps_url', 'labels'],
    ['place_id', 'new', 'gem', 'gem_line', 'seen_before', 'changes', 'dims'])) return;
  if (it.n !== undefined) tgEnvInt(errs, at + '.n', it.n, 1, 999);
  if (it.slug !== undefined) tgEnvSlug(errs, at + '.slug', it.slug);
  if (it.name !== undefined) tgEnvStr(errs, at + '.name', it.name, 1, 120);
  if (it.why_you !== undefined) tgEnvStr(errs, at + '.why_you', it.why_you, 0, 160);
  if (it.fit !== undefined) tgEnvNum(errs, at + '.fit', it.fit, 0, 1);
  if (it.est_minutes !== undefined) tgEnvInt(errs, at + '.est_minutes', it.est_minutes, 0, 1440);
  if (it.area !== undefined) tgEnvStr(errs, at + '.area', it.area, 0, 120);
  if (it.maps_url !== undefined) tgEnvUrl(errs, at + '.maps_url', it.maps_url);
  if (it.labels !== undefined && tgEnvArr(errs, at + '.labels', it.labels, 4)) it.labels.forEach(function (l, j) { tgEnvEnum(errs, at + '.labels[' + j + ']', l, TG_ENV_LABELS); });
  if (it.place_id !== undefined) tgEnvStr(errs, at + '.place_id', it.place_id, 6, 300, TG_ENV_RE.placeId);
  if (it['new'] !== undefined) tgEnvBool(errs, at + '.new', it['new']);
  if (it.gem !== undefined) tgEnvBool(errs, at + '.gem', it.gem);
  if (it.gem_line !== undefined) tgEnvStr(errs, at + '.gem_line', it.gem_line, 0, 200);
  if (it.seen_before !== undefined && tgEnvObj(errs, at + '.seen_before', it.seen_before, ['trip', 'on', 'outcome'])) {
    if (it.seen_before.trip !== undefined) tgEnvSlug(errs, at + '.seen_before.trip', it.seen_before.trip);
    if (it.seen_before.on !== undefined) tgEnvStr(errs, at + '.seen_before.on', it.seen_before.on, 10, 10, TG_ENV_RE.date);
    if (it.seen_before.outcome !== undefined) tgEnvEnum(errs, at + '.seen_before.outcome', it.seen_before.outcome, TG_ENV_OUTCOMES);
  }
  if (it.changes !== undefined && tgEnvArr(errs, at + '.changes', it.changes, 10)) it.changes.forEach(function (c, j) { tgEnvStr(errs, at + '.changes[' + j + ']', c, 1, 120); });
  if (it.dims !== undefined && tgEnvArr(errs, at + '.dims', it.dims, 10)) it.dims.forEach(function (d, j) {
    if (!tgEnvObj(errs, at + '.dims[' + j + ']', d, ['dimension', 'value'])) return;
    if (d.dimension !== undefined) tgEnvStr(errs, at + '.dims[' + j + '].dimension', d.dimension, 1, 32, TG_ENV_RE.ident);
    if (d.value !== undefined) tgEnvStr(errs, at + '.dims[' + j + '].value', d.value, 1, 80);
  });
}
function tgEnvValidateShortlist(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['trip', 'run_id', 'round', 'groups', 'more'], ['v', 'kind', 'decided'])) return errs;
  tgEnvHead(errs, p, 'shortlist');
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.run_id !== undefined) tgEnvStr(errs, 'run_id', p.run_id, 1, 120);
  if (p.round !== undefined) tgEnvInt(errs, 'round', p.round, 0, 50);
  if (p.more !== undefined && typeof p.more !== 'boolean') tgEnvInt(errs, 'more', p.more, 0, 1000);
  if (p.decided !== undefined && tgEnvArr(errs, 'decided', p.decided, 200)) p.decided.forEach(function (s, i) { tgEnvSlug(errs, 'decided[' + i + ']', s); });
  if (p.groups !== undefined && tgEnvArr(errs, 'groups', p.groups, 2)) {
    var slugs = {};
    p.groups.forEach(function (g, gi) {
      var at = 'groups[' + gi + ']';
      if (!tgEnvObj(errs, at, g, ['id', 'items'], ['gems_wanted', 'gems_shown'])) return;
      if (g.id !== undefined) tgEnvEnum(errs, at + '.id', g.id, ['activities', 'food']);
      if (g.gems_wanted !== undefined) tgEnvInt(errs, at + '.gems_wanted', g.gems_wanted, 0, 8);
      if (g.gems_shown !== undefined) tgEnvInt(errs, at + '.gems_shown', g.gems_shown, 0, 8);
      if (g.items === undefined || !tgEnvArr(errs, at + '.items', g.items, 20)) return;
      g.items.forEach(function (it, i) {
        tgEnvShortlistItem(errs, at + '.items[' + i + ']', it);
        if (isPlainObject(it) && typeof it.slug === 'string') {
          if (slugs[it.slug]) errs.push(at + '.items[' + i + ']: slug ' + truncate(it.slug, 40) + ' is listed twice');
          slugs[it.slug] = true;
        }
      });
      tgEnvDupes(errs, at + '.items', g.items, 'n', 'number');
      if (typeof g.gems_shown === 'number' && g.gems_shown > g.items.length) errs.push(at + '.gems_shown exceeds the group\'s items');
    });
    tgEnvDupes(errs, 'groups', p.groups, 'id', 'group');
  }
  return tgEnvDone(errs);
}
var TG_ENV_FACT_KINDS = ['dates', 'lodging', 'flight', 'booking', 'companions', 'other'];
function tgEnvValidateTripFacts(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['trip', 'found', 'missing'], ['v', 'kind'])) return errs;
  tgEnvHead(errs, p, 'trip_facts');
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.found !== undefined && tgEnvArr(errs, 'found', p.found, 40)) {
    p.found.forEach(function (f, i) {
      var at = 'found[' + i + ']';
      if (!tgEnvObj(errs, at, f, ['n', 'kind', 'text'], ['start', 'end'])) return;
      if (f.n !== undefined) tgEnvInt(errs, at + '.n', f.n, 1, 999);
      if (f.kind !== undefined) tgEnvEnum(errs, at + '.kind', f.kind, TG_ENV_FACT_KINDS);
      if (f.text !== undefined) tgEnvStr(errs, at + '.text', f.text, 1, 200);
      if (f.start !== undefined) tgEnvDateOrNull(errs, at + '.start', f.start);
      if (f.end !== undefined) tgEnvDateOrNull(errs, at + '.end', f.end);
      if (tgEnvRealDate(f.start) && tgEnvRealDate(f.end) && f.end < f.start) errs.push(at + '.end is before start');
    });
    tgEnvDupes(errs, 'found', p.found, 'n', 'number');
  }
  if (p.missing !== undefined && tgEnvArr(errs, 'missing', p.missing, 10)) {
    p.missing.forEach(function (m, i) { tgEnvEnum(errs, 'missing[' + i + ']', m, TG_ENV_FACT_KINDS); });
    p.missing.forEach(function (m, i) { if (p.missing.indexOf(m) !== i) errs.push('missing[' + i + ']: duplicate entry'); });
  }
  return tgEnvDone(errs);
}
function tgEnvValidatePlanDigest(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['trip', 'build_id', 'verified_on', 'days', 'later', 'drive'], ['v', 'kind'])) return errs;
  tgEnvHead(errs, p, 'plan_digest');
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.build_id !== undefined) tgEnvStr(errs, 'build_id', p.build_id, 1, 120);
  if (p.verified_on !== undefined) tgEnvDate(errs, 'verified_on', p.verified_on);
  if (p.days !== undefined && tgEnvArr(errs, 'days', p.days, 31)) {
    p.days.forEach(function (d, i) {
      var at = 'days[' + i + ']';
      if (!tgEnvObj(errs, at, d, ['date', 'theme', 'stops', 'legs', 'warnings'], ['rain'])) return;
      if (d.date !== undefined) {
        tgEnvDate(errs, at + '.date', d.date);
        var prev = i ? p.days[i - 1] : null;
        if (prev && isPlainObject(prev) && tgEnvRealDate(prev.date) && tgEnvRealDate(d.date) && d.date <= prev.date) errs.push(at + '.date: days must be in date order without duplicates');
      }
      if (d.theme !== undefined) tgEnvStr(errs, at + '.theme', d.theme, 0, 80);
      if (d.stops !== undefined && tgEnvArr(errs, at + '.stops', d.stops, 25)) {
        d.stops.forEach(function (s, j) {
          var as = at + '.stops[' + j + ']';
          if (!tgEnvObj(errs, as, s, ['n', 'slug', 'name', 'arrive', 'depart', 'minutes', 'maps_url', 'note_line'])) return;
          if (s.n !== undefined) tgEnvInt(errs, as + '.n', s.n, 1, 99);
          if (s.slug !== undefined) tgEnvSlug(errs, as + '.slug', s.slug);
          if (s.name !== undefined) tgEnvStr(errs, as + '.name', s.name, 1, 120);
          if (s.arrive !== undefined) tgEnvStr(errs, as + '.arrive', s.arrive, 5, 5, TG_ENV_RE.time);
          if (s.depart !== undefined) tgEnvStr(errs, as + '.depart', s.depart, 5, 5, TG_ENV_RE.time);
          if (s.minutes !== undefined) tgEnvInt(errs, as + '.minutes', s.minutes, 0, 1440);
          if (s.maps_url !== undefined) tgEnvUrl(errs, as + '.maps_url', s.maps_url);
          if (s.note_line !== undefined) tgEnvStr(errs, as + '.note_line', s.note_line, 0, 160);
        });
        tgEnvDupes(errs, at + '.stops', d.stops, 'n', 'stop number');
      }
      if (d.legs !== undefined && tgEnvArr(errs, at + '.legs', d.legs, 26)) {
        d.legs.forEach(function (l, j) {
          var al = at + '.legs[' + j + ']';
          if (!tgEnvObj(errs, al, l, ['from', 'to', 'mode', 'minutes'], ['maps_url'])) return;
          if (l.from !== undefined) tgEnvSlug(errs, al + '.from', l.from);
          if (l.to !== undefined) tgEnvSlug(errs, al + '.to', l.to);
          if (l.mode !== undefined) tgEnvEnum(errs, al + '.mode', l.mode, ['TRANSIT', 'DRIVE', 'WALK']);
          if (l.minutes !== undefined) tgEnvInt(errs, al + '.minutes', l.minutes, 0, 1440);
          if (l.maps_url !== undefined) tgEnvUrl(errs, al + '.maps_url', l.maps_url);
        });
      }
      if (d.warnings !== undefined && tgEnvArr(errs, at + '.warnings', d.warnings, 20)) d.warnings.forEach(function (w, j) { tgEnvStr(errs, at + '.warnings[' + j + ']', w, 1, 200); });
      if (d.rain !== undefined && tgEnvArr(errs, at + '.rain', d.rain, 2)) {
        d.rain.forEach(function (r, j) {
          var ar = at + '.rain[' + j + ']';
          if (!tgEnvObj(errs, ar, r, ['slug', 'name', 'instead_of', 'km', 'maps_url'])) return;
          if (r.slug !== undefined) tgEnvSlug(errs, ar + '.slug', r.slug);
          if (r.name !== undefined) tgEnvStr(errs, ar + '.name', r.name, 1, 120);
          if (r.instead_of !== undefined) tgEnvStr(errs, ar + '.instead_of', r.instead_of, 1, 120);
          if (r.km !== undefined && !(typeof r.km === 'number' && isFinite(r.km) && r.km >= 0 && r.km <= 100)) errs.push(ar + '.km must be a number from 0 to 100');
          if (r.maps_url !== undefined) tgEnvUrl(errs, ar + '.maps_url', r.maps_url);
        });
      }
    });
  }
  if (p.later !== undefined && tgEnvArr(errs, 'later', p.later, 200)) {
    p.later.forEach(function (l, i) {
      var at = 'later[' + i + ']';
      if (!tgEnvObj(errs, at, l, ['slug', 'name', 'reason'])) return;
      if (l.slug !== undefined) tgEnvSlug(errs, at + '.slug', l.slug);
      if (l.name !== undefined) tgEnvStr(errs, at + '.name', l.name, 1, 120);
      if (l.reason !== undefined) tgEnvStr(errs, at + '.reason', l.reason, 1, 300);
    });
    tgEnvDupes(errs, 'later', p.later, 'slug', 'place');
  }
  if (p.drive !== undefined && tgEnvObj(errs, 'drive', p.drive, ['plan', 'brochure_html', 'brochure_pdf'])) {
    ['plan', 'brochure_html', 'brochure_pdf'].forEach(function (k) {
      var v = p.drive[k];
      if (v !== undefined && v !== null && (typeof v !== 'string' || !TG_ENV_RE.driveId.test(v))) errs.push('drive.' + k + ' must be a Drive file id or null');
    });
  }
  tgEnvSize(errs, p);
  return tgEnvDone(errs);
}
function tgEnvValidateProfileSummary(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['text'], ['v', 'kind', 'dimensions_count', 'updated'])) return errs;
  tgEnvHead(errs, p, 'profile_summary');
  if (p.text !== undefined) tgEnvStr(errs, 'text', p.text, 1, 1200);
  if (p.dimensions_count !== undefined) tgEnvInt(errs, 'dimensions_count', p.dimensions_count, 0, 1000);
  if (p.updated !== undefined) {
    tgEnvStr(errs, 'updated', p.updated, 1, 40, TG_ENV_RE.zoned);
    if (typeof p.updated === 'string' && TG_ENV_RE.zoned.test(p.updated) && (!tgEnvRealDate(p.updated.slice(0, 10)) || isNaN(Date.parse(p.updated)))) errs.push('updated is not a real date-time');
  }
  return tgEnvDone(errs);
}
var TG_ENV_HELD_REASONS = ['unknown_dimension', 'suspect_only', 'tied', 'low_support', 'negative_single_value'];
function tgEnvValidatePrefsReview(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['v', 'kind', 'vocab', 'batch_id', 'items', 'held_back', 'more'])) return errs;
  if (p.v !== 1) errs.push('v must be 1');
  if (p.kind !== 'prefs_review') errs.push('kind must be "prefs_review"');
  if (p.vocab !== undefined) tgEnvStr(errs, 'vocab', p.vocab, 1, 32, TG_ENV_RE.ident);
  if (p.batch_id !== undefined) tgEnvStr(errs, 'batch_id', p.batch_id, 20, 20, TG_ENV_RE.batch);
  if (p.more !== undefined) tgEnvInt(errs, 'more', p.more, 0);
  if (p.items !== undefined && tgEnvArr(errs, 'items', p.items, 40)) {
    p.items.forEach(function (it, i) {
      var at = 'items[' + i + ']';
      if (!tgEnvObj(errs, at, it, ['cid', 'dimension', 'value', 'stance', 'statement', 'suspect', 'text', 'buttons'])) return;
      if (it.cid !== undefined) tgEnvStr(errs, at + '.cid', it.cid, 12, 12, TG_ENV_RE.cid);
      if (it.dimension !== undefined) tgEnvStr(errs, at + '.dimension', it.dimension, 1, 32, TG_ENV_RE.ident);
      if (it.value !== undefined) tgEnvStr(errs, at + '.value', it.value, 1, 200);
      if (it.stance !== undefined) tgEnvEnum(errs, at + '.stance', it.stance, ['+', '-']);
      if (it.statement !== undefined) tgEnvStr(errs, at + '.statement', it.statement, 1, 400);
      if (it.suspect !== undefined) tgEnvBool(errs, at + '.suspect', it.suspect);
      if (it.text !== undefined) tgEnvStr(errs, at + '.text', it.text, 1, 1200);
      if (it.buttons !== undefined && tgEnvArr(errs, at + '.buttons', it.buttons, 3, 1)) {
        it.buttons.forEach(function (row, j) {
          if (!tgEnvArr(errs, at + '.buttons[' + j + ']', row, 3, 1)) return;
          row.forEach(function (b, k) {
            var ab = at + '.buttons[' + j + '][' + k + ']';
            if (!tgEnvObj(errs, ab, b, ['text', 'data'])) return;
            if (b.text !== undefined) tgEnvStr(errs, ab + '.text', b.text, 1, 40);
            if (b.data !== undefined) {
              tgEnvStr(errs, ab + '.data', b.data, 1, 64, TG_ENV_RE.pfData);
              if (typeof b.data === 'string' && b.data.split(':')[1] !== it.cid) errs.push(ab + '.data must name ' + truncate(String(it.cid), 20));
            }
          });
        });
      }
    });
    tgEnvDupes(errs, 'items', p.items, 'cid', 'candidate');
  }
  if (p.held_back !== undefined && tgEnvArr(errs, 'held_back', p.held_back, 1000)) {
    p.held_back.forEach(function (h, i) {
      var at = 'held_back[' + i + ']';
      if (!tgEnvObj(errs, at, h, ['cid', 'statement', 'reason'])) return;
      if (h.cid !== undefined) tgEnvStr(errs, at + '.cid', h.cid, 12, 12, TG_ENV_RE.cid);
      if (h.statement !== undefined) tgEnvStr(errs, at + '.statement', h.statement, 1, 400);
      if (h.reason !== undefined) tgEnvEnum(errs, at + '.reason', h.reason, TG_ENV_HELD_REASONS);
    });
  }
  return tgEnvDone(errs);
}
var TG_ENV_PLACE_STATUSES = ['candidate', 'chosen', 'scheduled', 'saved-for-later', 'rejected'];
function tgEnvValidatePlacesDigest(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'payload', p, ['destination', 'places'], ['v', 'kind'])) return errs;
  tgEnvHead(errs, p, 'places_digest');
  if (p.destination !== undefined) tgEnvSlug(errs, 'destination', p.destination);
  if (p.places !== undefined && tgEnvArr(errs, 'places', p.places, 500)) {
    p.places.forEach(function (pl, i) {
      var at = 'places[' + i + ']';
      tgGoogleFieldsIn(pl).forEach(function (k) { errs.push(at + ': Google field "' + k + '" refused (own data only)'); });
      if (!tgEnvObj(errs, at, pl, TG_PLACE_OWN)) return;
      if (pl.slug !== undefined) tgEnvSlug(errs, at + '.slug', pl.slug);
      if (pl.name !== undefined) tgEnvStr(errs, at + '.name', pl.name, 1, 120);
      if (pl.area !== undefined) tgEnvStr(errs, at + '.area', pl.area, 0, 120);
      if (pl.category !== undefined) tgEnvStr(errs, at + '.category', pl.category, 1, 32, TG_ENV_RE.category);
      if (pl.tags !== undefined && tgEnvArr(errs, at + '.tags', pl.tags, 20)) pl.tags.forEach(function (t, j) { tgEnvStr(errs, at + '.tags[' + j + ']', t, 1, 40); });
      if (pl.status !== undefined) tgEnvEnum(errs, at + '.status', pl.status, TG_ENV_PLACE_STATUSES);
      if (pl.last_trip !== undefined && pl.last_trip !== null) tgEnvSlug(errs, at + '.last_trip', pl.last_trip);
      if (pl.last_researched !== undefined) tgEnvDateOrNull(errs, at + '.last_researched', pl.last_researched);
      if (pl.last_verified !== undefined) tgEnvDateOrNull(errs, at + '.last_verified', pl.last_verified);
      if (pl.note_line !== undefined) tgEnvStr(errs, at + '.note_line', pl.note_line, 0, 160);
      if (pl.maps_url !== undefined) tgEnvUrl(errs, at + '.maps_url', pl.maps_url);
      if (pl.history_summary !== undefined) tgEnvStr(errs, at + '.history_summary', pl.history_summary, 0, 120);
    });
    tgEnvDupes(errs, 'places', p.places, 'slug', 'place');
  }
  tgEnvSize(errs, p);
  return tgEnvDone(errs);
}

/* ---------------- hand-off: the plan flow, else the WP-5a renderer, else one plain line ---------------- */
/** true when the owner's active flow is `plan` for this trip and took the envelope (contract §1.4). */
function tgEnvToFlow(type, env) {
  var chat = tgOwnerChat();
  if (!chat) return false;
  var f = flowActive(chat);
  if (!f || f.flow !== 'plan' || !isPlainObject(f.state) || f.state.trip !== env.payload.trip) return false;
  flowResume(chat, { type: 'resume', event: type, payload: env.payload, env_id: env.id, in_reply_to: env.in_reply_to || null });
  return true;
}
/**
 * Render through getRenderer('tg_<type>') → { messages: [{ html, keyboard? }] } and send; else send plainHtml.
 * onSent (optional, WP-9b) gets [{ m, r }] — each rendered message and its sendMessage answer — after the sends.
 */
function tgEnvRender(type, payload, plainHtml, onSent) {
  var fn = getRenderer('tg_' + type);
  if (fn) {
    var pairs = [], rendered = false;
    try {
      var out = fn(payload);
      var msgs = typeof out === 'string' ? [{ html: out }] : (out && Array.isArray(out.messages) ? out.messages : []);
      var sent = 0;
      msgs.forEach(function (m) {
        var html = typeof m === 'string' ? m : (m && m.html ? String(m.html) : '');
        if (!html) return;
        var r = tgSendOwner(html, m && m.keyboard ? { keyboard: m.keyboard } : undefined);
        pairs.push({ m: typeof m === 'string' ? { html: m } : m, r: r });
        sent++;
      });
      rendered = sent > 0;
    } catch (e) { auditFail('tg_render_error', type, describeError(e)); }
    if (onSent && pairs.length) { try { onSent(pairs); } catch (e2) { auditFail('tg_render_onsent_error', type, describeError(e2)); } }
    if (rendered) return 'renderer';
  }
  tgSendOwner(plainHtml);
  return 'plain';
}
function tgEnvDeliver(type, env, plainHtml, onSent) { return tgEnvToFlow(type, env) ? 'flow' : tgEnvRender(type, env.payload, plainHtml, onSent); }
function tgEnvCount(groups) { var n = 0; (groups || []).forEach(function (g) { n += (g.items || []).length; }); return n; }

registerEnvelopeHandler('shortlist', {
  validate: tgEnvCleaned(tgEnvValidateShortlist),
  handle: function (env) {
    var p = env.payload;
    var trip = tgTripUpsert({ slug: p.trip });
    if (trip.status !== 'done') tgTripSetStatus(p.trip, 'choosing');
    var st = tgShortlistStore(p);
    var to = tgEnvDeliver('shortlist', env, '🗂 Shortlist for <b>' + tgEscape(p.trip) + '</b> (round ' + st.round + '): ' + st.count + ' options. Send /plan to choose.',
      function (pairs) { tgAppRememberRound(tgOwnerChat(), p.trip, st.run, st.round, pairs); });   // message ids for the app's keyboard refresh (WP-9b)
    return { trip: p.trip, run: st.run, round: st.round, items: st.count, to: to };
  }
});
registerEnvelopeHandler('trip_facts', {
  validate: tgEnvCleaned(tgEnvValidateTripFacts),
  handle: function (env) {
    var p = env.payload;
    tgTripUpsert({ slug: p.trip });
    var to = tgEnvDeliver('trip_facts', env, '📋 Trip facts for <b>' + tgEscape(p.trip) + '</b>: ' + p.found.length + ' found, ' + p.missing.length + ' missing. Send /plan to confirm them.');
    return { trip: p.trip, found: p.found.length, missing: p.missing.length, to: to };
  }
});
registerEnvelopeHandler('plan_digest', {
  validate: tgEnvCleaned(tgEnvValidatePlanDigest),
  handle: function (env) {
    var p = env.payload;
    var st = tgDigestStore(p);
    var to = tgEnvDeliver('plan_digest', env, '🗓 Plan for <b>' + tgEscape(p.trip) + '</b> stored: ' + st.days + ' day(s), ' + st.later + ' saved for later. /trip shows it.');
    return { trip: p.trip, days: st.days, later: st.later, to: to };
  }
});
registerEnvelopeHandler('profile_summary', {
  validate: tgEnvCleaned(tgEnvValidateProfileSummary),
  handle: function (env) {
    tgProfileSummaryStore(env.payload);
    var r = tgSendOwner('🧭 <b>Your travel profile</b>\n' + tgEscape(env.payload.text));
    return { stored: true, sent: !!(r && r.ok) };
  }
});

/**
 * Proposals: the core's own built-in actions (drive_create_file) are on ACTION_ALLOWLIST for every pack, but Tour Guide's
 * contract is that the core executes only the pack's allowlist (helper.json action_allowlist — empty). A brain proposal
 * for anything else is refused before the owner sees a ✅ card (WP-6a, red-team A14).
 */
registerProposalGuard('tg_pack_allowlist', function (env, p) {
  var allowed = HELPER.action_allowlist || [];
  return allowed.indexOf(p && p.action) >= 0 ? null : 'action ' + truncate(String(p && p.action), 40) + ' is not on the Tour Guide allowlist (' + (allowed.join(', ') || 'none') + ')';
});

/* ---------------- prefs_review: pf:<cid>:y|e|n, ✏️ capture, decisions → kind prefs ---------------- */
var TG_PF = { BATCHES: 'tg_pf_batches', EDIT: 'tg_pf_edit', EDIT_TTL_MIN: 30, KEEP_BATCHES: 5, VALUE_MAX: 200 };
var TG_PF_CODES = { y: 'confirm', e: 'edit', n: 'reject' };
function tgPfLoad() { var b = tgShJson(settingGet(TG_PF.BATCHES, ''), null); return Array.isArray(b) ? b : []; }
function tgPfSave(batches) {
  // The newest KEEP_BATCHES batches (newest last); a tap on an older one answers "That review has ended".
  var keep = batches.slice(-TG_PF.KEEP_BATCHES);
  settingSet(TG_PF.BATCHES, toJson(keep), 'prefs review batches (pf buttons)');
}
function tgPfFind(batches, cid) {
  for (var i = batches.length - 1; i >= 0; i--) {
    var b = batches[i];
    for (var j = 0; j < b.items.length; j++) if (b.items[j].cid === cid) return { batch: b, item: b.items[j] };
  }
  return null;
}
function tgPfMark(d) {
  if (!d) return '';
  if (d.decision === 'confirm') return '✅ Kept';
  if (d.decision === 'reject') return '❌ Dropped';
  return '✏️ Changed to: <b>' + tgEscape(d.value) + '</b>';
}
function tgPfKeyboard(cid) {
  return tgKeyboard([[{ text: '✅ Confirm', data: cbEncode('pf', cid, 'y') }, { text: '✏️ Edit', data: cbEncode('pf', cid, 'e') },
    { text: '❌ Reject', data: cbEncode('pf', cid, 'n') }]]);
}
/** When every item of the batch is decided: open kind `prefs` with payload.decisions (contract §1.8). */
function tgPfMaybeFinish(batches, b) {
  if (b.request_id || !b.items.every(function (it) { return b.decisions[it.cid]; })) return null;
  var doc = { v: 1, kind: 'prefs_decisions', source: 'owner', via: 'telegram', batch_id: b.batch_id,
    decisions: b.items.map(function (it) {
      var d = b.decisions[it.cid], o = { cid: it.cid, decision: d.decision, decided_at: d.decided_at };
      if (d.decision === 'edit') o.value = d.value;
      return o;
    }) };
  b.request_id = 'pending';
  tgPfSave(batches);
  var r;
  try {
    r = tgOpenKindRequest('prefs', { decisions: doc }, { text: 'Preference review: ' + doc.decisions.length + ' decision(s)',
      ack: '🧠 Updating your profile with ' + doc.decisions.length + ' decision(s)…' });
  } catch (e) {
    b.request_id = '';
    tgPfSave(batches);
    auditFail('tg_pf_request_error', b.batch_id, describeError(e));
    tgSendOwner('⚠️ Could not send your preference decisions yet — tap any decided item again to retry.');
    return null;
  }
  b.request_id = r.id;
  tgPfSave(batches);
  return r.id;
}
registerEnvelopeHandler('prefs_review', {
  validate: tgEnvCleaned(tgEnvValidatePrefsReview),
  handle: function (env) {
    var p = env.payload;
    if (!p.items.length) return { items: 0, sent: 0 };
    var batches = tgPfLoad();
    var b = batches.filter(function (x) { return x.batch_id === p.batch_id; })[0];
    if (b && b.request_id) return { items: p.items.length, sent: 0, already_decided: true };
    if (!b) { b = { batch_id: p.batch_id, vocab: p.vocab, received_at: nowIso(), items: [], decisions: {}, request_id: '' }; batches.push(b); }
    var todo = p.items.filter(function (it) { return !b.decisions[it.cid]; });
    b.items = p.items.map(function (it) {
      var old = b.items.filter(function (x) { return x.cid === it.cid; })[0];
      return { cid: it.cid, statement: it.statement, mid: old ? old.mid : '' };
    });
    tgPfSave(batches);
    tgSendOwner('🧭 <b>' + todo.length + ' preference' + (todo.length === 1 ? '' : 's') + ' to review</b> — ✅ keep · ✏️ change · ❌ drop' +
      (p.more ? '\n' + p.more + ' more after these.' : ''), { silent: true });
    var sent = 0;
    todo.forEach(function (it) {
      var html = tgEscape(it.text) + (it.suspect ? '\n⚠️ <i>Some of the evidence for this looked like instructions — check it before keeping it.</i>' : '');
      var r = tgSendOwner(html, { keyboard: tgPfKeyboard(it.cid) });
      var mine = b.items.filter(function (x) { return x.cid === it.cid; })[0];
      if (r && r.ok && r.result && r.result.message_id) mine.mid = String(r.result.message_id);
      sent++;
    });
    tgPfSave(batches);
    return { batch_id: p.batch_id, items: p.items.length, sent: sent };
  }
});
registerCallback('pf', function (ctx) {
  var cid = String(ctx.parts[0] || ''), code = String(ctx.parts[1] || '');
  if (ctx.parts.length !== 2 || !TG_ENV_RE.cid.test(cid) || !TG_PF_CODES[code]) { ctx.answer('Unknown button'); return; }   // exact shape (WP-6a B8)
  var batches = tgPfLoad(), hit = tgPfFind(batches, cid);
  if (!hit) { ctx.answer('That review has ended.'); return; }
  if (hit.batch.request_id) { ctx.answer('Already sent — this review is closed.'); return; }
  if (code === 'e') {
    settingSet(TG_PF.EDIT, toJson({ batch_id: hit.batch.batch_id, cid: cid, mid: ctx.messageId ? String(ctx.messageId) : hit.item.mid,
      until: isoAfterMinutes(TG_PF.EDIT_TTL_MIN) }), 'pending ✏️ edit');
    ctx.answer('Send the new wording');
    var f = flowActive(ctx.chatId), busy = f && !f.paused;
    tgSend(ctx.chatId, '✏️ Send the new wording for: <i>' + tgEscape(hit.item.statement) + '</i> (within ' + TG_PF.EDIT_TTL_MIN + ' minutes, ≤ ' + TG_PF.VALUE_MAX + ' characters).' +
      (busy ? '\nℹ️ The <b>' + tgEscape(f.flow) + '</b> conversation reads your messages first — finish it or send /cancel, then send the new wording.' : ''));
    return;
  }
  hit.batch.decisions[cid] = { decision: TG_PF_CODES[code], decided_at: nowIso() };
  var pend = tgShJson(settingGet(TG_PF.EDIT, ''), null);
  if (pend && pend.cid === cid) settingSet(TG_PF.EDIT, '');
  tgPfSave(batches);
  ctx.answer(code === 'y' ? 'Kept' : 'Dropped');
  ctx.edit(tgEscape(hit.item.statement) + '\n' + tgPfMark(hit.batch.decisions[cid]));
  tgPfMaybeFinish(batches, hit.batch);
});
/**
 * Free text right after ✏️ is the replacement value. Named tg_capture_* so it runs before Lane B (contract §1.6);
 * claims text only while an edit is pending and unexpired. An active, unpaused flow still claims text first (router).
 */
registerMessageHandler('tg_capture_pf_edit', function (ctx) {
  var pend = tgShJson(settingGet(TG_PF.EDIT, ''), null);
  if (!isPlainObject(pend) || !pend.cid) return false;
  var until = parseIso(pend.until);
  if (!until || until.getTime() <= nowMs()) { settingSet(TG_PF.EDIT, ''); return false; }
  var batches = tgPfLoad(), hit = tgPfFind(batches, pend.cid);
  if (!hit || hit.batch.request_id) { settingSet(TG_PF.EDIT, ''); return false; }
  var text = String(ctx.text || '').replace(/\s+/g, ' ').trim();
  if (!text) { ctx.reply('✏️ Send the new wording as text (or tap ✅ / ❌ instead).'); return true; }
  if (text.length > TG_PF.VALUE_MAX) { ctx.reply('✏️ Please keep it under ' + TG_PF.VALUE_MAX + ' characters.'); return true; }
  hit.batch.decisions[pend.cid] = { decision: 'edit', value: text, decided_at: nowIso() };
  settingSet(TG_PF.EDIT, '');
  tgPfSave(batches);
  var mid = pend.mid || hit.item.mid;
  if (mid) tgEdit(ctx.chatId, mid, tgEscape(hit.item.statement) + '\n' + tgPfMark(hit.batch.decisions[pend.cid]));
  ctx.reply('✏️ Noted: <b>' + tgEscape(text) + '</b>', { silent: true });
  tgPfMaybeFinish(batches, hit.batch);
  return true;
});

/* ---------------- places_digest ---------------- */
/** The payload of an open request, read back from to-brain/req_<id>.json ({} when gone or unreadable). */
function tgEnvRequestPayload(id) {
  try {
    var it = getMailboxFolders().toBrain.getFilesByName('req_' + id + '.json');
    if (!it.hasNext()) return {};
    var parsed = safeJsonParse(it.next().getBlob().getDataAsString('UTF-8'));
    return parsed.ok && isPlainObject(parsed.value) && isPlainObject(parsed.value.payload) ? parsed.value.payload : {};
  } catch (e) { return {}; }
}
function tgEnvPlaceLine(pl) {
  var name = '<b>' + tgEscape(pl.name) + '</b>';
  var note = pl.note_line ? ' — ' + tgEscape(pl.note_line) : '';
  if (pl.kind === 'new') return '🆕 new: ' + name + note;
  if (pl.kind === 'changed') return (pl.status === 'rejected' ? '❌ changed: ' + name + ' (no longer suggested)' : '🔄 changed: ' + name) + note;
  return '✅ still open: ' + name + (pl.last_verified ? ' · checked ' + tgEscape(pl.last_verified) : '');
}
registerEnvelopeHandler('places_digest', {
  validate: tgEnvCleaned(tgEnvValidatePlacesDigest),
  handle: function (env) {
    var p = env.payload;
    var res = tgPlacesUpsert(p);
    var out = { destination: p.destination, added: res.added, changed: res.changed, verified: res.verified, same: res.same, said: 'nothing' };
    var req = env.in_reply_to ? getRequest(env.in_reply_to) : null;
    if (req && String(req.kind) === 'places') {
      var scope = String(tgEnvRequestPayload(req.id).scope || 'check');
      if (scope === 'check') {
        var lines = ['🔁 <b>Fresh check — ' + tgEscape(p.destination) + '</b>'].concat(res.places.map(tgEnvPlaceLine));
        if (!res.places.length) lines.push('Nothing changed since the last check.');
        tgLines(lines).forEach(function (m) { tgSendOwner(m); });
        out.said = 'check';
      } else {
        var n = tgPlacesCounts()[p.destination] || 0;
        tgSendOwner('📍 <b>' + tgEscape(p.destination) + '</b>: ' + n + ' place' + (n === 1 ? '' : 's') + ' in the repository — /places to search.');
        out.said = 'count';
      }
    } else if (res.added + res.changed > 0) {
      tgSendOwner('📍 Places for <b>' + tgEscape(p.destination) + '</b> updated: ' + res.added + ' new, ' + res.changed + ' changed — /places to look.', { silent: true });
      out.said = 'count';
    }
    return out;
  }
});

/**
 * A core `reply` that answers a `brochure` request and names Drive files (labels `plan`, `brochure_html`, `brochure_pdf` —
 * the same keys `plan_digest.drive` uses) → remember them on the trip, as tgDigestStore does, so the next /brochure or 📄
 * resends the file instead of opening another request (WP-6c C7/R4). Runs after the core handler sent the files.
 */
registerEnvelopeObserver('tg_brochure_reply', function (env) {
  if (!env || env.type !== 'reply' || !env.in_reply_to) return;
  var p = env.payload || {}, ids = p.drive_file_ids;
  if (!isPlainObject(ids)) return;
  var req = getRequest(env.in_reply_to);
  if (!req || req.kind !== 'brochure') return;                     // the cheap sheet check first; the trip is only in the file
  var rq = mailboxReadRequest(env.in_reply_to), rp = rq && isPlainObject(rq.payload) ? rq.payload : null;
  if (!rp || typeof rp.trip !== 'string' || !tgTripGet(rp.trip)) return;
  var upd = { slug: rp.trip };
  ['plan', 'brochure_html', 'brochure_pdf'].forEach(function (label) {
    if (typeof ids[label] === 'string' && ids[label]) upd['drive_' + label] = ids[label];
  });
  if (Object.keys(upd).length > 1) tgTripUpsert(upd);
});

// Developed by: LightAISolutions
