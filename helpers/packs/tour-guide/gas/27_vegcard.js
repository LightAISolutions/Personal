/**
 * Tour Guide pack — the veg card (TG-PHASE-14 WP-14c, Contract C14): the party's "what we cannot eat" card, in the
 * destination's language and English, built by the routine once per trip and shown from storage after that.
 *   /vegcard            → the current trip's stored card (rendered here, every string escaped); none stored → request
 *                         kind `vegcard` { trip } with "🥗 Making the veg card for <trip>…"
 *   /vegcard rebuild    → always a request { trip, rebuild: true }
 *   kind `vegcard`      → routine RESEARCH (TG_KIND_ROUTINE, set below) until wave 2's Discover routing
 *   envelope `veg_card` → validated (tgEnvValidateVegCard, the mirror of schemas/tour-guide-veg-card.schema.json and
 *                         vegcard/vegcard-payload.mjs; a card for a trip the core does not know is refused, audited by the
 *                         core's envelope_rejected), stored in the VegCards tab (one row per trip, with its fp), and sent
 *                         to the owner when it answers an open `vegcard` request or its fp changed — otherwise silent
 *   tgVegCardMorningLine(trip) → the morning message's "🥗 Veg card — /vegcard" line when the trip has a card
 * App: 37_vegcard_app.js (vegcard.get) and has_vegcard on the trip row (32_app_api.js). Defaults: helpers/decisions/WP-14c.md.
 * Built by hand; the @branch line below only tells `new-branch.mjs --check vegcard` its names (helpers/tools/README.md).
 */
// @branch vegcard command=/vegcard kind=vegcard envelope=veg_card tab=VegCards app=yes
var TG_VEGCARD = {
  SHEET: 'VegCards', KIND: 'vegcard', TYPE: 'veg_card', MAX_CHARS: 8000,
  SECTIONS: ['intro', 'avoid', 'ok', 'ask', 'thanks'], LANGS: ['ja', null], DIETS: ['vegetarian', 'vegan', null],
  FP_RE: /^vcf1:[0-9a-f]{8}$/, COUNTRY_RE: /^[A-Z]{2}$/,
  HEADER: '🥗 Veg card — show this to the staff',
  NO_LANG: 'No local-language phrases for this country yet — English only.',
  ENGLISH_ONLY: 'Also cannot eat — show this in a translation app:'
};
TG_KIND_ROUTINE[TG_VEGCARD.KIND] = 'RESEARCH';   // read by tgKindRoutine at call time (00_common.js)

registerSheet(TG_VEGCARD.SHEET, ['id', 'fp', 'lang', 'diet', 'party', 'card_json', 'received_at']);

/* ==================== the VegCards tab ==================== */

var _tgVcSlugs = null;   // trips with a card, read once per run (the app's trip rows ask for each trip); a store clears it
/** The stored card of a trip → { trip, fp, card, received_at } or null (a row whose JSON no longer parses is ignored). */
function tgVegCardGet(slug) {
  slug = String(slug || '');
  if (!TG_SLUG_RE.test(slug)) return null;
  var r = storeGet(TG_VEGCARD.SHEET, slug);
  if (!r) return null;
  var j = typeof r.card_json === 'string' ? safeJsonParse(r.card_json) : { ok: false };
  if (!j.ok || !isPlainObject(j.value) || !Array.isArray(j.value.sections)) return null;
  return { trip: slug, fp: tgShStr(r.fp), card: j.value, received_at: tgShStr(r.received_at) };
}
function tgVegCardHas(slug) {
  if (!_tgVcSlugs) {
    _tgVcSlugs = {};
    storeAll(TG_VEGCARD.SHEET).forEach(function (r) { if (r.card_json) _tgVcSlugs[tgShStr(r.id)] = true; });
  }
  return Object.prototype.hasOwnProperty.call(_tgVcSlugs, String(slug || ''));
}
/** Store a validated card (one row per trip). → { rec, previous_fp } */
function tgVegCardStore(p) {
  var prev = storeGet(TG_VEGCARD.SHEET, p.trip);
  storeUpsertById(TG_VEGCARD.SHEET, { id: p.trip, fp: p.fp, lang: p.lang || '', diet: p.diet || '', party: p.party,
    card_json: toJson(p), received_at: nowIso() });
  _tgVcSlugs = null;
  return { rec: tgVegCardGet(p.trip), previous_fp: prev ? tgShStr(prev.fp) : '' };
}

/* ==================== the chat card (the same HTML as vegcard-render.mjs vegCardTelegram) ==================== */

/** Lines of the card: local text in bold with its English in italics beneath; English alone in bold when lang is null. */
function tgVegCardLines(card) {
  var lines = ['<b>' + tgEscape(TG_VEGCARD.HEADER) + '</b>'];
  if (card.lang === null) lines.push('<i>' + tgEscape(TG_VEGCARD.NO_LANG) + '</i>');
  (Array.isArray(card.sections) ? card.sections : []).forEach(function (s) {
    lines.push('');
    (s && Array.isArray(s.lines) ? s.lines : []).forEach(function (l) {
      lines.push(l.local ? '<b>' + tgEscape(l.local) + '</b>\n<i>' + tgEscape(l.en) + '</i>' : '<b>' + tgEscape(l.en) + '</b>');
    });
  });
  var eo = Array.isArray(card.english_only) ? card.english_only : [];
  if (eo.length) {
    lines.push('', tgEscape(TG_VEGCARD.ENGLISH_ONLY));
    eo.forEach(function (v) { lines.push('• <b>' + tgEscape(v) + '</b>'); });
  }
  return lines;
}
function tgVegCardMessages(rec) { return tgCmdMessages(tgVegCardLines(rec.card), null); }

/* ==================== asking ==================== */

/** Open a `vegcard` request for a trip. → tgOpenKindRequest's result. */
function tgVegCardAsk(trip, rebuild, chat, text) {
  var payload = { trip: trip.slug };
  if (rebuild) payload.rebuild = true;
  return tgOpenKindRequest('vegcard', payload, {   // the literal kind (TG_VEGCARD.KIND), so --check finds the opener
    chat: chat || null, text: text || ('/vegcard' + (rebuild ? ' rebuild' : '')),
    ack: '🥗 Making the veg card for ' + tgCmdTitle(trip) + '…' });
}

registerCommand('/vegcard', function (ctx) {
  var arg = String(ctx.args || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (arg && arg !== 'rebuild') { ctx.reply('Usage: /vegcard · /vegcard rebuild'); return; }
  var trip = tgCmdCurrent(ctx);
  if (!trip) return;
  var rec = arg ? null : tgVegCardGet(trip.slug);
  if (rec) { tgCmdSendAll(ctx.chatId, tgVegCardMessages(rec)); return; }
  tgVegCardAsk(trip, arg === 'rebuild', ctx.chat, String(ctx.text || ''));
}, 'the party\'s veg card for the current trip, in the local language and English: /vegcard · /vegcard rebuild');

/** The morning message's line (18_morning.js) when the trip has a card; '' otherwise. */
function tgVegCardMorningLine(trip) {
  return trip && trip.slug && tgVegCardHas(trip.slug) ? '🥗 Veg card — /vegcard' : '';
}

/* ==================== the envelope ==================== */

/** Mirror of schemas/tour-guide-veg-card.schema.json plus vegcard/vegcard-payload.mjs checkVegCard. */
function tgEnvValidateVegCard(p) {
  var errs = [];
  if (!tgEnvObj(errs, 'veg_card', p, ['v', 'trip', 'country', 'lang', 'diet', 'party', 'fp', 'sections', 'english_only'])) return errs;
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.trip !== undefined) tgEnvSlug(errs, 'trip', p.trip);
  if (p.country !== undefined && p.country !== null) tgEnvStr(errs, 'country', p.country, 2, 2, TG_VEGCARD.COUNTRY_RE);
  if (p.lang !== undefined) tgEnvEnum(errs, 'lang', p.lang, TG_VEGCARD.LANGS);
  if (p.diet !== undefined) tgEnvEnum(errs, 'diet', p.diet, TG_VEGCARD.DIETS);
  if (p.party !== undefined) tgEnvInt(errs, 'party', p.party, 1, 12);
  if (p.fp !== undefined) tgEnvStr(errs, 'fp', p.fp, 13, 13, TG_VEGCARD.FP_RE);
  if (p.sections !== undefined && tgEnvArr(errs, 'sections', p.sections, 6, 1)) {
    var last = -1, seen = {};
    p.sections.forEach(function (s, i) {
      var at = 'sections[' + i + ']';
      if (!tgEnvObj(errs, at, s, ['id', 'lines'])) return;
      if (s.id !== undefined) {
        tgEnvEnum(errs, at + '.id', s.id, TG_VEGCARD.SECTIONS);
        var k = TG_VEGCARD.SECTIONS.indexOf(s.id);
        if (k >= 0) {
          if (seen[s.id]) errs.push(at + '.id: section "' + s.id + '" appears twice');
          else if (k < last) errs.push(at + '.id: section "' + s.id + '" out of order (intro, avoid, ok, ask, thanks)');
          seen[s.id] = true;
          last = Math.max(last, k);
        }
      }
      if (s.lines !== undefined && tgEnvArr(errs, at + '.lines', s.lines, 12, 1)) {
        s.lines.forEach(function (l, j) {
          var lt = at + '.lines[' + j + ']';
          if (!tgEnvObj(errs, lt, l, ['local', 'en'])) return;
          if (l.local !== undefined && l.local !== null) tgEnvStr(errs, lt + '.local', l.local, 1, 200);
          if (l.en !== undefined) tgEnvStr(errs, lt + '.en', l.en, 1, 200);
          if (p.lang === null && l.local !== null && l.local !== undefined) errs.push(lt + '.local must be null when lang is null');
          if (p.lang !== null && p.lang !== undefined && l.local === null) errs.push(lt + '.local must be a string when lang is set');
        });
      }
    });
  }
  if (p.english_only !== undefined && tgEnvArr(errs, 'english_only', p.english_only, 12)) {
    p.english_only.forEach(function (v, i) { tgEnvStr(errs, 'english_only[' + i + ']', v, 1, 60); });
  }
  var n = toJson(p).length;
  if (n >= TG_VEGCARD.MAX_CHARS) errs.push('payload is ' + n + ' chars (must stay under ' + TG_VEGCARD.MAX_CHARS + ')');
  return tgEnvDone(errs);
}
/** The registered validate: the payload mirror, then the trip must be one the core knows (an unknown trip is refused). */
function tgVegCardValidate(p, env) {
  var errs = tgEnvCleaned(tgEnvValidateVegCard)(p, env);
  if (!errs.length && !tgTripGet(p.trip)) errs.push('trip: unknown trip "' + truncate(String(p.trip), 64) + '"');
  return errs;
}
/** True when env answers an open `vegcard` request (the core marks it answered only after handle()). */
function tgVegCardAnswers(env) {
  if (!env || !env.in_reply_to) return false;
  var r = getRequest(env.in_reply_to);
  return !!(r && r.kind === TG_VEGCARD.KIND && r.status === 'open');
}

if (ENVELOPE_TYPES.indexOf(TG_VEGCARD.TYPE) >= 0) {
  registerEnvelopeHandler(TG_VEGCARD.TYPE, {
    validate: tgVegCardValidate,
    handle: function (env) {
      var p = env.payload, answers = tgVegCardAnswers(env), st = tgVegCardStore(p);
      var changed = st.previous_fp !== p.fp, chat = tgOwnerChat(), last = null;
      if ((answers || changed) && chat) last = tgCmdSendAll(chat, tgVegCardMessages(st.rec));
      return { trip: p.trip, fp: p.fp, answered: answers, changed: changed, sent: !!(last && last.ok) };
    }
  });
}

// Developed by: LightAISolutions
