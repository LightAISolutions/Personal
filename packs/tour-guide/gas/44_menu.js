/**
 * Tour Guide pack — Menu check (TG-PHASE-16 WP-16b, Contract C16): for a restaurant the owner is about to choose, the
 * dishes the party can eat and the ones to ask about, read from the restaurant's own menu and dated.
 *   /menu <restaurant> [on <date>] → request kind `menu` { trip?, place, slug?, date? } (trip: the current trip whenever
 *                         there is one); routed to RESEARCH (TG_KIND_ROUTINE), or to DISCOVER when configured (TG_DISCOVER_KINDS)
 *   /menu               → the planned dinners from today on that have a 🍽 button (tgMenuDayRows), the last 5 checks as
 *                         resend buttons, then a one-line how-to (only the how-to when there is neither)
 *   envelope `menu`     → validated (tgEnvValidateMenu, mirror of schemas/tour-guide-menu.schema.json and of
 *                         packs/tour-guide/menu/menu-payload.mjs; own data only, every Google field refused), stored in the
 *                         Menus tab (a re-delivered id replaces its row), then the card with the re-plan offer
 *   callback mn:<key>:s · mn:<key>:v · mn:<key>:r<yyyymmdd> → resend the card · the trip's veg card · re-plan that day
 *            mn:<trip key>:<yyyymmdd>:<tag> → the day's 🍽 Check the menu (four parts where a check's buttons have three)
 *   tgMenuDayRows(trip, day) → the day's 🍽 row for the skeleton's hooks (tgCmdDayRows: the day card, the morning message)
 *   state.json `menu_checks` (C16) → the checks of the last 30 days, newest first, at most 50
 * Check keys are "k" + 12 hex of the check id's hash (Scout's rule). App operations: gas/39_menu_app.js. Pack side:
 * packs/tour-guide/menu/. Tests: tests/pack_tour-guide_menu*.test.js. Defaults: helpers/decisions/WP-16b.md.
 * Other pack files' names (tgDaytripDate, tgVegCard*) are touched only inside functions, at run time.
 * The @branch line below tells `new-branch.mjs --check menu` what this branch declares ("-" = not needed); keep it in step.
 */
// @branch menu command=/menu kind=menu envelope=menu tab=Menus routine=RESEARCH app=yes discover=yes
var TG_MENU = {
  SHEET: 'Menus', PAYLOAD_MAX: 12000, LIST_MAX: 20, PLACE_MAX: 80, DISHES: 12, OTHERS_MAX: 200, SOURCES_MAX: 3, NOTE_MAX: 160,
  CHAT_DINNERS: 8,     // /menu alone: at most 8 dinner buttons (C16 WP-16b step 1)
  CHAT_CHECKS: 5,      // /menu alone: the last 5 checks
  OFFER_MAX: 3,        // the re-plan offer covers at most 3 planned days
  SNAP_DAYS: 30, SNAP_MAX: 50,   // state.json menu_checks (C16)
  MAX_AGE_DAYS: 30,    // mirror of the facts pack's MENU_MAX_AGE_DAYS (a parity test): a check counts for a dinner at most 30 days before it
  ID_RE: /^mn-\d{8}-[a-z0-9-]{1,40}$/, KEY_RE: /^k[0-9a-f]{12}$/,
  // Mirror of the pack's CAVEAT_RE (menu/menu-check.mjs): dinnerMenu's two caveats at the start of the note or after " · ".
  CAVEAT_RE: /(?:^|\s·\s)menu\s+(not checked for|last checked)\s+\S/i
};
var TG_MENU_COURSES = ['set', 'main', 'starter', 'side', 'dessert', 'drink'];
var TG_MENU_DISH_FITS = ['yes', 'ask'];
var TG_MENU_FITS = ['yes', 'partly', 'no', 'unknown'];
var TG_MENU_FITS_LINE = { yes: '✅ Fits your party', partly: '🟡 Partly fits — ask first', no: '⛔ Nothing on the menu fits', unknown: '❔ No menu found to check' };
var TG_MENU_FITS_WORD = { yes: 'fits', partly: 'partly fits', no: 'does not fit', unknown: 'no menu found' };

// The kind's routing, added from this file: tgKindRoutine (00_common.js) reads the table at call time.
TG_KIND_ROUTINE['menu'] = 'RESEARCH';
// A discovery kind (--discover): with a DISCOVER routine configured, tgKindRoutine sends it there instead.
if (TG_DISCOVER_KINDS.indexOf('menu') < 0) TG_DISCOVER_KINDS.push('menu');

registerSheet(TG_MENU.SHEET, ['id', 'trip', 'place_slug', 'place_name', 'checked', 'fits', 'payload_json', 'received_at']);

/* ==================== the owner's words ==================== */

var TG_MENU_ON_RE = /(?:^|\s+)on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|today|tomorrow)\s*$/i;

function tgMenuClean(s) { return String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); }
/**
 * The owner's words → { ok: true, place, date | null } | { ok: false, why: 'no_place' | 'too_long' | 'bad_date' | 'past_date' }.
 * Mirror of parseMenuText (packs/tour-guide/menu/menu-text.mjs) rule for rule; the shared case list
 * menu/fixtures/menu-parse-cases.json holds both to one answer. "on <date>" closes the text at most once and takes
 * /daytrip's date words (tgDaytripDate); "on" before anything but a date stays part of the name ("Kettle on the Quay").
 */
function tgMenuParse(text, today) {
  var s = tgMenuClean(text).replace(/^\/menu(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim(), date = null;
  var m = TG_MENU_ON_RE.exec(s);
  if (m) {
    var r = tgDaytripDate(m[1], today);
    if (r.why) return { ok: false, why: r.why };
    date = r.date;
    s = s.slice(0, m.index);
  }
  var place = tgMenuClean(s);
  if (!place) return { ok: false, why: 'no_place' };
  if (place.length > TG_MENU.PLACE_MAX) return { ok: false, why: 'too_long' };
  return { ok: true, place: place, date: date };
}
/** Today where the trip is (the owner's zone without a trip): the day an M/D, "tomorrow" and "from today on" count from. */
function tgMenuToday(trip) { return trip ? tgTripToday(trip) : isoDateIn(getTz()); }
/** Mirror of menuCounts (menu-check.mjs): the check was made at most MAX_AGE_DAYS before the dinner's date (or after it). */
function tgMenuCounts(checked, date) {
  var n = tgCmdDaysBetween(checked, date);
  return n !== null && n <= TG_MENU.MAX_AGE_DAYS;
}
/** Mirror of menuCountsFrom: the first `checked` that counts for a dinner on `date`. */
function tgMenuCountsFrom(date) { return isoDateAdd(date, -TG_MENU.MAX_AGE_DAYS); }
/** 'YYYY-MM-DD' → 'YYYYMMDD' (a callback part). */
function tgMenuD8(date) { return String(date || '').replace(/-/g, ''); }
function tgMenuDate8(d8) { var m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(d8 || '')); return m && tgEnvRealDate(m[1] + '-' + m[2] + '-' + m[3]) ? m[1] + '-' + m[2] + '-' + m[3] : ''; }

/* ==================== asking ==================== */

var TG_MENU_USAGE = '🍽 Which restaurant? <code>/menu Brindle Lantern on 5/13</code> — the dishes your party can eat, read from its own menu.';
var TG_MENU_WHY = {
  no_place: TG_MENU_USAGE,
  too_long: '🍽 Please keep the restaurant under ' + TG_MENU.PLACE_MAX + ' characters — nothing was asked.',
  bad_date: '🍽 I could not read that date — try <code>on 2027-05-14</code>, <code>on 5/14</code>, <code>on today</code> or <code>on tomorrow</code>. Nothing was asked.',
  past_date: '🍽 That date has already passed — nothing was asked.',
  bad_slug: '🍽 That place is not one I know — nothing was asked.'
};
/**
 * Open a `menu` request (C16): opts = { place (1–80), slug?, date? (YYYY-MM-DD, not past), trip? (a trip record; default
 * the current trip), chat?, text? }. `trip` is that trip whenever there is one; a 🍽 button sets slug and date.
 * → { ok: true, id, routine, fired, trip, place, slug, date } | { ok: false, why: 'no_place' | 'too_long' | 'bad_slug' | 'bad_date' | 'past_date' }
 */
function tgMenuOpen(opts) {
  opts = opts || {};
  var place = tgMenuClean(opts.place), slug = String(opts.slug || ''), date = String(opts.date || '');
  var trip = opts.trip === undefined ? tgTripCurrent() : opts.trip;
  if (!place) return { ok: false, why: 'no_place' };
  if (place.length > TG_MENU.PLACE_MAX) return { ok: false, why: 'too_long' };
  if (slug && !TG_SLUG_RE.test(slug)) return { ok: false, why: 'bad_slug' };
  if (date && !tgEnvRealDate(date)) return { ok: false, why: 'bad_date' };
  if (date && date < tgMenuToday(trip)) return { ok: false, why: 'past_date' };
  var payload = {};
  if (trip) payload.trip = trip.slug;
  payload.place = place;
  if (slug) payload.slug = slug;
  if (date) payload.date = date;
  var r = tgOpenKindRequest('menu', payload, { chat: opts.chat || null, text: opts.text || '/menu ' + place + (date ? ' on ' + date : ''),
    ack: '🍽 Reading the menu of <b>' + tgEscape(place) + '</b>…' });
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), trip: payload.trip || '', place: place, slug: slug, date: date };
}

registerCommand('/menu', function (ctx) {
  var args = tgMenuClean(ctx.args);
  if (!args) { tgMenuChatList(ctx.chatId); return; }
  var q = tgMenuParse(args, tgMenuToday(tgTripCurrent()));
  if (!q.ok) { ctx.reply(TG_MENU_WHY[q.why] || TG_MENU_USAGE); return; }
  // The request carries the owner's words as typed (Scout's rule).
  var r = tgMenuOpen({ place: q.place, date: q.date || '', chat: ctx.chat, text: String(ctx.text || '') });
  if (!r.ok) ctx.reply(TG_MENU_WHY[r.why] || TG_MENU_USAGE);
}, 'what your party can eat at a restaurant, from its own menu: /menu Brindle Lantern on 5/13');

/**
 * /menu alone: the planned dinners of the current trip from today on that get a 🍽 button (tgMenuDayButton, ≤ 8), then
 * the last 5 checks as resend buttons, then the how-to; only the how-to when there is neither.
 */
function tgMenuChatList(chatId) {
  var trip = tgTripCurrent(), lines = [], btns = [], dinners = [];
  if (trip) {
    tgDigestDays(trip.slug).forEach(function (d) {
      if (dinners.length >= TG_MENU.CHAT_DINNERS) return;
      var b = tgMenuDayButton(trip, d);
      if (b) dinners.push({ day: d, button: b });
    });
  }
  var checks = tgMenuList(TG_MENU.CHAT_CHECKS);
  if (!dinners.length && !checks.length) { tgSend(chatId, TG_MENU_USAGE); return; }
  if (dinners.length) {
    lines.push('🍽 <b>Planned dinners</b>');
    dinners.forEach(function (x) {
      var d = x.day;
      lines.push('Day ' + d.n + ' · ' + tgCmdDate(d.date) + ' — ' + tgCmdHref(d.dinner.maps_url, d.dinner.name) + ': ' +
        (x.button.rec ? 'menu ' + TG_MENU_FITS_WORD[x.button.rec.fits] + ', checked ' + tgCmdDate(x.button.rec.checked) : 'menu to check'));
      btns.push({ text: '🍽 ' + d.n + ' · ' + truncate(String(d.dinner.name), 30), data: x.button.data });
    });
  }
  if (checks.length) {
    lines.push('🍽 <b>Your last checks</b>');
    checks.forEach(function (c) {
      lines.push('• ' + tgEscape(c.place_name) + ' — ' + TG_MENU_FITS_WORD[c.fits] + ' · checked ' + tgCmdDate(c.checked));
      btns.push({ text: '🍽 ' + truncate(c.place_name, 30), data: cbEncode('mn', tgMenuKey(c.id), 's') });
    });
  }
  lines.push('', TG_MENU_USAGE);
  return tgCmdSendAll(chatId, tgCmdMessages(lines, tgKeyboard(tgCmdRows(btns, 2))));
}

/* ==================== the Menus tab ==================== */

/** A row → { id, trip, place_slug, place_name, checked, fits, received_at, payload } (payload: the stored check, {} when unreadable). */
function tgMenuRec(r) {
  if (!r) return null;
  var p = typeof r.payload_json === 'string' ? safeJsonParse(r.payload_json) : { ok: false };
  var fits = tgShStr(r.fits);
  return { id: tgShStr(r.id), trip: tgShStr(r.trip), place_slug: tgShStr(r.place_slug), place_name: tgShStr(r.place_name),
    checked: tgShDate(r.checked), fits: TG_MENU_FITS.indexOf(fits) >= 0 ? fits : 'unknown', received_at: tgShStr(r.received_at),
    payload: p.ok && isPlainObject(p.value) ? p.value : {} };
}
function tgMenuRow(id) {
  id = String(id || '');
  if (!TG_MENU.ID_RE.test(id)) return null;
  return storeFind(TG_MENU.SHEET, function (r) { return tgShStr(r.id) === id; }, 1)[0] || null;
}
/** The stored check, or null. */
function tgMenuGet(id) { return tgMenuRec(tgMenuRow(id)); }
/** Newest first (received_at, then row order); limit optional. */
function tgMenuList(limit) {
  var rows = storeAll(TG_MENU.SHEET).map(function (r) { var x = tgMenuRec(r); x._row = r._row; return x; });
  rows.sort(function (a, b) { return a.received_at !== b.received_at ? (a.received_at < b.received_at ? 1 : -1) : b._row - a._row; });
  rows.forEach(function (x) { delete x._row; });
  return limit ? rows.slice(0, limit) : rows;
}
/** The newest check of a place (by `checked`, then by arrival), or null. Checks of every trip count: a menu is the place's. */
function tgMenuNewest(placeSlug) {
  var best = null;
  tgMenuList(0).forEach(function (c) { if (c.place_slug === placeSlug && c.checked && (!best || c.checked > best.checked)) best = c; });
  return best;
}
/** Store a validated payload, one row per check id; a re-delivered id replaces its row. → { rec, replaced } */
function tgMenuStore(p) {
  var replaced = !!tgMenuRow(p.id);
  storeUpsertById(TG_MENU.SHEET, { id: p.id, trip: p.trip || '', place_slug: p.place.slug, place_name: p.place.name, checked: p.checked,
    fits: p.fits, payload_json: toJson(p), received_at: nowIso() });
  return { rec: tgMenuGet(p.id), replaced: replaced };
}
/** The check's own trip while it is on file, else null. */
function tgMenuTrip(rec) { return rec && rec.trip ? tgTripGet(rec.trip) : null; }

/* ==================== the `menu` envelope ==================== */

function tgEnvMenuDish(errs, at, d) {
  if (!tgEnvObj(errs, at, d, ['name', 'course', 'fits'], ['local', 'ask', 'price'])) return;
  if (d.name !== undefined) tgEnvStr(errs, at + '.name', d.name, 1, 80);
  if (d.local !== undefined) tgEnvStr(errs, at + '.local', d.local, 1, 80);
  if (d.course !== undefined) tgEnvEnum(errs, at + '.course', d.course, TG_MENU_COURSES);
  if (d.fits !== undefined) tgEnvEnum(errs, at + '.fits', d.fits, TG_MENU_DISH_FITS);
  if (d.ask !== undefined) tgEnvStr(errs, at + '.ask', d.ask, 1, 120);
  if (d.price !== undefined) tgEnvStr(errs, at + '.price', d.price, 1, 40);
  if (d.fits === 'ask' && d.ask === undefined) errs.push(at + '.ask required when fits is ask');
  if (d.fits === 'yes' && d.ask !== undefined) errs.push(at + '.ask only when fits is ask');
}
/**
 * Mirror of schemas/tour-guide-menu.schema.json and of validateMenuPayload (packs/tour-guide/menu/menu-payload.mjs),
 * rule for rule and message for message (C16): required keys, types, enums, sizes, `ask` exactly on the dishes to ask
 * about, a source unless fits is unknown, real dates, no Google field anywhere (tgScoutGoogleKeys), and the whole payload
 * at most 12 000 characters.
 */
function tgEnvValidateMenu(p) {
  var errs = [];
  if (!isPlainObject(p)) return ['payload must be an object'];
  tgScoutGoogleKeys(p, '').forEach(function (k) { errs.push(k + ': Google field refused (own data only)'); });
  if (!tgEnvObj(errs, 'payload', p, ['id', 'trip', 'created_on', 'place', 'checked', 'fits', 'note', 'diet', 'dishes', 'sources'], ['v', 'date', 'others'])) return tgEnvDone(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.id !== undefined) tgEnvStr(errs, 'id', p.id, 1, 52, TG_MENU.ID_RE);
  if (p.trip !== undefined && p.trip !== null) tgEnvSlug(errs, 'trip', p.trip);
  if (p.created_on !== undefined) tgEnvDate(errs, 'created_on', p.created_on);
  if (p.date !== undefined) tgEnvDate(errs, 'date', p.date);
  if (p.place !== undefined && tgEnvObj(errs, 'place', p.place, ['name', 'slug'], ['place_id', 'local_name'])) {
    if (p.place.name !== undefined) tgEnvStr(errs, 'place.name', p.place.name, 1, 120);
    if (p.place.slug !== undefined) tgEnvSlug(errs, 'place.slug', p.place.slug);
    if (p.place.place_id !== undefined) tgEnvStr(errs, 'place.place_id', p.place.place_id, 6, 300, TG_ENV_RE.placeId);
    if (p.place.local_name !== undefined) tgEnvStr(errs, 'place.local_name', p.place.local_name, 1, 80);
  }
  if (p.checked !== undefined) tgEnvDate(errs, 'checked', p.checked);
  if (p.fits !== undefined) tgEnvEnum(errs, 'fits', p.fits, TG_MENU_FITS);
  if (p.note !== undefined) tgEnvStr(errs, 'note', p.note, 1, TG_MENU.NOTE_MAX);
  if (p.diet !== undefined) tgEnvStr(errs, 'diet', p.diet, 1, 80);
  if (p.dishes !== undefined && tgEnvArr(errs, 'dishes', p.dishes, TG_MENU.DISHES)) p.dishes.forEach(function (d, i) { tgEnvMenuDish(errs, 'dishes[' + i + ']', d); });
  if (p.others !== undefined) tgEnvInt(errs, 'others', p.others, 0, TG_MENU.OTHERS_MAX);
  if (p.sources !== undefined && tgEnvArr(errs, 'sources', p.sources, TG_MENU.SOURCES_MAX)) {
    p.sources.forEach(function (s, i) {
      var at = 'sources[' + i + ']';
      if (!tgEnvObj(errs, at, s, ['title', 'url'])) return;
      if (s.title !== undefined) tgEnvStr(errs, at + '.title', s.title, 1, 120);
      if (s.url !== undefined) tgEnvUrl(errs, at + '.url', s.url);
    });
    if (!p.sources.length && p.fits !== 'unknown') errs.push('sources: at least 1 entry unless fits is unknown');
  }
  tgEnvSize(errs, p);
  var n = toJson(p).length;
  if (n > TG_MENU.PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + TG_MENU.PAYLOAD_MAX + ')');
  return tgEnvDone(errs);
}

/** The handler registers only while helper.json lists the type: an unlisted type cannot be registered and the core rejects it, audited. */
if (ENVELOPE_TYPES.indexOf('menu') >= 0) {
  registerEnvelopeHandler('menu', {
    validate: function (p, env) {
      var errs = tgEnvCleaned(tgEnvValidateMenu)(p, env);
      // A check names a trip the core knows, or none (null): the vegcard rule.
      if (!errs.length && p.trip !== null && !tgTripGet(p.trip)) errs.push('trip: unknown trip "' + truncate(String(p.trip), 64) + '"');
      return errs;
    },
    handle: function (env) {
      var st = tgMenuStore(env.payload), chat = tgOwnerChat(), r = chat ? tgMenuSend(chat, st.rec) : null;
      return { menu: st.rec.id, replaced: st.replaced, fits: st.rec.fits, sent: !!(r && r.ok) };
    }
  });
}

/* ==================== the re-plan offer ==================== */

/** "day 2 (Thu 11 Jun)" */
function tgMenuDayLabel(d) { return 'day ' + d.n + ' (' + tgCmdDate(d.date) + ')'; }
/** A planned day's dinner slug, or '' (a stored day is not trusted to be well formed). */
function tgMenuDinnerSlug(d) {
  var x = d && isPlainObject(d.dinner) ? d.dinner : null;
  return x && typeof x.name === 'string' && x.name && typeof x.slug === 'string' && TG_SLUG_RE.test(x.slug) ? x.slug : '';
}
/**
 * What the card offers (C16 WP-16b step 4): the planned days of the check's trip from tgTripToday on whose dinner is the
 * check's place, at most 3. Nothing when fits is unknown or the trip is not on file. Per day: { day, replan: true } when
 * fits is no or the check counts for that day (tgMenuCounts), else { day, replan: false, from } (a check counts from then),
 * with again: true once that date has come (a resent old check: a new check would count now).
 */
function tgMenuOffer(rec) {
  var trip = tgMenuTrip(rec);
  if (!trip || !rec.place_slug || rec.fits === 'unknown') return [];
  var today = tgTripToday(trip);
  return tgDigestDays(trip.slug).filter(function (d) { return d.date >= today && tgMenuDinnerSlug(d) === rec.place_slug; })
    .slice(0, TG_MENU.OFFER_MAX).map(function (d) {
      if (rec.fits === 'no' || tgMenuCounts(rec.checked, d.date)) return { day: d, replan: true };
      var from = tgMenuCountsFrom(d.date);
      return from <= today ? { day: d, replan: false, from: from, again: true } : { day: d, replan: false, from: from };
    });
}
/**
 * Re-plan one day with a check (the card's 🔁 button and the app's menu.replan): the day's dinner is checked again first.
 * → { ok: true, id, routine, fired, day } | { ok: false, why: 'no_trip' | 'changed' | 'not_offered' }
 */
function tgMenuReplan(rec, date, opts) {
  opts = opts || {};
  var trip = tgMenuTrip(rec);
  if (!trip) return { ok: false, why: 'no_trip' };
  var day = tgDigestDay(trip.slug, date);
  if (!day || tgMenuDinnerSlug(day) !== rec.place_slug) return { ok: false, why: 'changed' };
  var o = tgMenuOffer(rec).filter(function (x) { return x.day.date === date; })[0];
  if (!o || !o.replan) return { ok: false, why: 'not_offered' };
  var name = rec.place_name || rec.place_slug;
  var r = tgOpenKindRequest('replan', { trip: trip.slug, dates: [date], reason: 'menu checked at ' + truncate(name, 120), deliverables: tgCmdDeliverables(trip) },
    { chat: opts.chat || null, text: 're-plan day ' + day.n + ' with the menu check of ' + name,
      ack: '🔁 Re-planning ' + tgMenuDayLabel(day) + ' with the checked menu…' });
  return { ok: true, id: r.id, routine: r.routine, fired: !!(r.fired && r.fired.ok), day: day };
}

/* ==================== the card ==================== */

/** A check id as a callback part: "k" + 12 hex of its hash (Scout's board keys). */
function tgMenuKey(id) { return 'k' + sha1Hex(String(id || '')).slice(0, 12); }
function tgMenuByKey(key) {
  key = String(key || '');
  if (!TG_MENU.KEY_RE.test(key)) return null;
  var all = tgMenuList(0);
  for (var i = 0; i < all.length; i++) if (tgMenuKey(all[i].id) === key) return all[i];
  return null;
}
/** A source's https page as a link (the validators allow https only); anything else is plain text (What's on's rule). */
function tgMenuHref(url, text) {
  var u = String(url || ''), t = tgEscape(text);
  return /^https:\/\/\S+$/.test(u) && u.length <= 2000 ? '<a href="' + tgEscape(u).replace(/"/g, '&quot;') + '">' + t + '</a>' : t;
}
/** "✅ <name> (<local>) · <price>" or "❓ <name> (<local>) · <price> — ask: <ask>"; the optional parts only when given. */
function tgMenuDishLine(d) {
  var s = (d.fits === 'ask' ? '❓ ' : '✅ ') + tgEscape(d.name) + (d.local ? ' (' + tgEscape(d.local) + ')' : '') + (d.price ? ' · ' + tgEscape(d.price) : '');
  return d.fits === 'ask' && d.ask ? s + ' — ask: ' + tgEscape(d.ask) : s;
}
/** The app button: the shell's Menu screen opened on this check ([] without APP_SHELL_URL). */
function tgMenuAppRows(rec, label) {
  var u = tgAppUrl('menu', rec.trip || '');
  return u ? [[{ text: label || '📱 Open in the app', web_app: { url: u + '&menu=' + encodeURIComponent(rec.id) } }]] : [];
}
/** 🔁 Re-plan <day> per offered day, 🥗 Veg card when the trip has one, then 📱 Open in the app; null when there is nothing. */
function tgMenuKeyboard(rec, offer) {
  var key = tgMenuKey(rec.id), rows = [];
  (offer || tgMenuOffer(rec)).forEach(function (o) {
    if (o.replan) rows.push([{ text: '🔁 Re-plan day ' + o.day.n, data: cbEncode('mn', key, 'r' + tgMenuD8(o.day.date)) }]);
  });
  if (rec.trip && tgVegCardHas(rec.trip)) rows.push([{ text: '🥗 Veg card', data: cbEncode('mn', key, 'v') }]);
  rows = rows.concat(tgMenuAppRows(rec));
  return rows.length ? tgKeyboard(rows) : null;
}
/**
 * The card as [{ html, keyboard? }]: "🍽 <b>Menu check: <name> (<local>)</b> · checked <date>", the fits line, "For: <diet>",
 * a line per dish, "+ N other dishes that do not fit", "Source:" and the links, then the re-plan offer's lines.
 */
function tgMenuMessages(rec) {
  var p = rec.payload, place = isPlainObject(p.place) ? p.place : {}, offer = tgMenuOffer(rec);
  var lines = ['🍽 <b>Menu check: ' + tgEscape(rec.place_name || place.name || rec.place_slug) + (place.local_name ? ' (' + tgEscape(place.local_name) + ')' : '') + '</b>' +
    (rec.checked ? ' · checked ' + tgCmdDate(rec.checked) : '')];
  lines.push(TG_MENU_FITS_LINE[rec.fits]);
  if (typeof p.diet === 'string' && p.diet) lines.push('For: ' + tgEscape(p.diet));
  (Array.isArray(p.dishes) ? p.dishes : []).filter(function (d) { return isPlainObject(d) && typeof d.name === 'string'; }).forEach(function (d) { lines.push(tgMenuDishLine(d)); });
  var others = typeof p.others === 'number' && p.others > 0 ? p.others : 0;
  if (others) lines.push('+ ' + others + ' other dish' + (others === 1 ? ' that does' : 'es that do') + ' not fit');
  var src = (Array.isArray(p.sources) ? p.sources : []).filter(isPlainObject).slice(0, TG_MENU.SOURCES_MAX).map(function (s) { return tgMenuHref(s.url, s.title); });
  if (src.length) lines.push('Source: ' + src.join(' · '));
  offer.forEach(function (o) {
    if (o.replan && rec.fits === 'no') lines.push('This dinner does not fit; re-plan ' + tgMenuDayLabel(o.day) + ' to replace it.');
    else if (o.again) lines.push('For ' + tgMenuDayLabel(o.day) + ' this check is too old to count; send 🍽 to check again.');
    else if (!o.replan) lines.push('For ' + tgMenuDayLabel(o.day) + ' a menu check counts from ' + tgCmdDate(o.from) + '; send 🍽 again then.');
  });
  return tgCmdMessages(lines, tgMenuKeyboard(rec, offer));
}
function tgMenuSend(chatId, rec) { return tgCmdSendAll(chatId, tgMenuMessages(rec)); }

/* ==================== the 🍽 row (C16 hooks: the day card and the morning message) ==================== */

/**
 * The day's 🍽 button, or null (C16 WP-16b step 6): only for a day from tgTripToday on whose dinner has a slug and a
 * caveat in its note_line (TG_MENU.CAVEAT_RE). from = tgMenuCountsFrom(day's date); the newest check of the dinner's place:
 *   checked on or after from → "🍽 Menu: <fits word>" resends it;
 *   older than from while today is still before from → the same resend (a new check would not count yet; the card says from when);
 *   otherwise (no check, or an older one) → "🍽 Check the menu": mn:<trip key>:<yyyymmdd>:<tag of the dinner's slug>.
 * → { text, data, check: <id> | null, rec: <the check> | null } | null
 */
function tgMenuDayButton(trip, day) {
  if (!trip || !isPlainObject(day) || !tgEnvRealDate(day.date)) return null;
  var slug = tgMenuDinnerSlug(day), today = tgTripToday(trip);
  if (!slug || day.date < today) return null;
  if (typeof day.dinner.note_line !== 'string' || !TG_MENU.CAVEAT_RE.test(day.dinner.note_line)) return null;
  var from = tgMenuCountsFrom(day.date), c = tgMenuNewest(slug);
  if (c && (c.checked >= from || today < from)) {
    return { text: '🍽 Menu: ' + TG_MENU_FITS_WORD[c.fits], data: cbEncode('mn', tgMenuKey(c.id), 's'), check: c.id, rec: c };
  }
  return { text: '🍽 Check the menu', data: cbEncode('mn', tgCmdTripKey(trip.slug), tgMenuD8(day.date), tgCmdTag(slug)), check: null, rec: null };
}
/** At most 1 row with one button, for tgCmdDayRows (10_commands.js). */
function tgMenuDayRows(trip, day) {
  var b = tgMenuDayButton(trip, day);
  return b ? [[{ text: b.text, data: b.data }]] : [];
}

/* ==================== the buttons ==================== */

/**
 * mn:<key>:s resends a check · mn:<key>:v sends its trip's veg card · mn:<key>:r<yyyymmdd> re-plans that day (the dinner
 * is checked again first) · mn:<trip key>:<yyyymmdd>:<tag> opens the day's menu check { trip, place, slug, date }.
 */
registerCallback('mn', function (ctx) {
  if (ctx.parts.length === 3) { tgMenuDayTap(ctx); return; }
  if (ctx.parts.length !== 2) { ctx.answer('Unknown button'); return; }
  var rec = tgMenuByKey(ctx.parts[0]), what = String(ctx.parts[1]), m = /^r(\d{8})$/.exec(what);
  if (!rec) { ctx.answer('That check is gone — send /menu.'); return; }
  if (what === 's') { ctx.answer(''); tgMenuSend(ctx.chatId, rec); return; }
  if (what === 'v') {
    var card = rec.trip ? tgVegCardGet(rec.trip) : null;
    if (!card) { ctx.answer('No veg card for that trip — send /vegcard.'); return; }
    ctx.answer('');
    tgCmdSendAll(ctx.chatId, tgVegCardMessages(card));
    return;
  }
  var date = m ? tgMenuDate8(m[1]) : '';
  if (!date) { ctx.answer('Unknown button'); return; }
  var r = tgMenuReplan(rec, date);
  if (r.ok) { ctx.answer('Re-planning day ' + r.day.n); return; }
  ctx.answer(r.why === 'changed' ? 'That day\'s dinner has changed — send /day again.' : r.why === 'no_trip' ? 'That trip is gone.' : 'That day is no longer offered — send /menu.');
});
/** The day's 🍽 Check the menu: the tag must still match that day's dinner, and the day must not have passed. */
function tgMenuDayTap(ctx) {
  var trip = tgCmdTripByKey(ctx.parts[0]), date = tgMenuDate8(ctx.parts[1]);
  var day = trip && date ? tgDigestDay(trip.slug, date) : null, slug = tgMenuDinnerSlug(day);
  if (!day || !slug || tgCmdTag(slug) !== String(ctx.parts[2])) { ctx.answer('That day has changed — send /day again.'); return; }
  if (date < tgTripToday(trip)) { ctx.answer('That day has passed.'); return; }
  var r = tgMenuOpen({ trip: trip, place: truncate(String(day.dinner.name), TG_MENU.PLACE_MAX), slug: slug, date: date });
  ctx.answer(r.ok ? 'Reading the menu' : 'That day has changed — send /day again.');
}

/* ==================== state.json `menu_checks` (C16) ==================== */

/** The checks of the last 30 days (by `checked`, in the owner's zone), newest first, at most 50: { id, trip, place_slug, checked, fits, note }. */
function tgMenuChecksSnapshot() {
  var since = isoDateAdd(isoDateIn(getTz()), -TG_MENU.SNAP_DAYS);
  var all = tgMenuList(0).filter(function (c) { return c.checked && c.checked >= since && c.place_slug; });
  all.sort(function (a, b) { return a.checked !== b.checked ? (a.checked < b.checked ? 1 : -1) : (a.received_at < b.received_at ? 1 : a.received_at > b.received_at ? -1 : 0); });
  return all.slice(0, TG_MENU.SNAP_MAX).map(function (c) {
    return { id: c.id, trip: c.trip || null, place_slug: c.place_slug, checked: c.checked, fits: c.fits, note: tgShStr(c.payload.note) };
  });
}
registerSnapshotProvider('menu_checks', tgMenuChecksSnapshot);

// Developed by: LightAISolutions
