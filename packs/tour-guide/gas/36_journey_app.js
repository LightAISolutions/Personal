/**
 * Tour Guide pack — the Mini App's Compare screen (TG-PHASE-11 WP-11f): the journey's operations on the route `?route=app`
 * (32_app_api.js; the core checked the owner's initData before any of them runs). Each one IS what the chat does
 * (17_journey.js: the same store, the same requests, the same flow events), so the chat and the app stay in step:
 *   journey.get { slug }                               → the trip, its newest outline and each date's current versions
 *   outline.choose { slug, build_id, base, mix? }      → the ✅ / /outline choice (mix { <date>: key } takes days from others)
 *   versions.get { slug, date }                        → one date's versions (the current set, else the newest stored)
 *   versions.choose { slug, build_id, date, key, replace? } → choose a version; replace: true on a planned day replans it
 *   versions.done { slug }                             → 🧱 Build my plan
 * Strings are plain (the app escapes them); refusals carry the chat's reason words as `reason`.
 * While /journey is off (the default until the private routine's Phase 11 update): journey.get answers `on: false` with the
 * one-line `text` and the app shows only that line; the other operations refuse with reason `off` (409) and send no request.
 */
var TG_APP_JY_STATUS = {
  bad_base: 400, bad_mix: 400, bad_date: 400, bad_key: 400, no_picks: 400,
  no_outline: 404, no_versions: 404, no_shortlist: 404,
  stale: 409, not_planned: 409, planning: 409, flow_stage: 409, busy: 409, no_chat: 409, off: 409
};
/** The switch is off → refuse before reading anything (no request can follow). */
function tgAppJyGate() { if (!tgJyOn()) tgAppRefuse(409, 'off', { text: TG_JY_OFF }); }
/** A refused journey action → the app's answer (status by reason; the chat's sentence as `text`). */
function tgAppJyNo(r) {
  var extra = { text: tgJyWhy(r) };
  if (r.field) extra.field = r.field;
  if (r.stage) extra.stage = tgAppS(r.stage);
  return tgAppNo(TG_APP_JY_STATUS[r.why] || 409, r.why || 'refused', extra);
}
function tgAppJyDate(args, k) { return tgAppStr(args, k, { required: true, max: 10, re: /^\d{4}-\d{2}-\d{2}$/ }); }
function tgAppJyBuild(args) { return tgAppStr(args, 'build_id', { required: true, max: TG_JY.BUILD_MAX }); }
function tgAppJyKey(args, k) { return tgAppStr(args, k, { required: true, max: 1, re: /^[ABC]$/ }); }

/* ---- what the app shows ---- */
function tgAppJyOutline(rec) {
  if (!rec) return null;
  var p = rec.payload;
  return {
    build_id: rec.build_id, keys: rec.keys.slice(), dates: rec.dates.slice(), notes: tgAppS(p.notes), received_at: rec.received_at,
    choice: rec.choice ? { base: rec.choice.base, mix: isPlainObject(rec.choice.mix) ? rec.choice.mix : {} } : null,
    options: p.options.map(function (o) {
      return { key: o.key, title: tgAppS(o.title), gains: tgAppS(o.gains), gives_up: tgAppS(o.gives_up),
        days: o.days.map(function (d) {
          return { date: d.date, area: tgAppS(d.area), kind: tgAppS(d.kind), note: tgAppS(d.note),
            anchors: (Array.isArray(d.anchors) ? d.anchors : []).map(function (a) { return { slug: tgAppS(a.slug), name: tgAppS(a.name) }; }) };
        }) };
    })
  };
}
function tgAppJyVersions(rec) {
  if (!rec) return null;
  return {
    build_id: rec.build_id, date: rec.date, key: rec.key, chosen: rec.chosen, received_at: rec.received_at,
    versions: rec.payload.versions.map(function (v) {
      return { key: v.key, title: tgAppS(v.title), summary: tgAppS(v.summary),
        stops: v.stops.map(function (s) { return { slug: tgAppS(s.slug), name: tgAppS(s.name), time: tgAppS(s.time) }; }),
        walk_minutes: tgAppNum(v.walk_minutes), transit_minutes: tgAppNum(v.transit_minutes), spare_minutes: tgAppNum(v.spare_minutes),
        bookings: v.bookings.map(tgAppS), warnings: v.warnings.map(tgAppS),
        leaves_out: v.leaves_out.map(function (l) { return { slug: tgAppS(l.slug), name: tgAppS(l.name) }; }) };
    })
  };
}
/** The trip's plan flow stage ('' with no flow) and whether 🧱 Build my plan can go now. */
function tgAppJyStage(slug, st) {
  var f = tgJyFlow(slug), stage = f ? tgAppS(f.state.stage) : '';
  return { stage: stage, can_build: st.have > 0 && (!f || stage === 'versions') };
}

/* ---- operations ---- */
/** journey.get { slug } — mode (outline | versions | ''), the newest outline, per trip date its current versions. */
function tgAppOpJourneyGet(args) {
  var t = tgAppTrip(args);
  if (!tgJyOn()) return tgAppOk({ trip: tgAppTripOut(t), on: false, text: TG_JY_OFF, mode: '', stage: '', outline: null, days: [], have: 0, missing: [],
    can_build: false, outline_min_days: TG_JY.OUTLINE_MIN_DAYS });
  var st = tgJyState(t.slug), s = tgAppJyStage(t.slug, st);
  var days = st.days.map(function (x, i) {
    return { date: x.date, n: i + 1, planned: !!tgDigestDay(t.slug, x.date), versions: tgAppJyVersions(x.rec) };
  });
  return tgAppOk({ trip: tgAppTripOut(t), on: true, mode: st.mode, stage: s.stage, outline: tgAppJyOutline(st.outline), days: days,
    have: st.have, missing: st.missing.slice(), can_build: s.can_build, outline_min_days: TG_JY.OUTLINE_MIN_DAYS });
}
/** outline.choose { slug, build_id, base, mix? } — the outline taken, days from others in mix; the day versions are asked for. */
function tgAppOpOutlineChoose(args) {
  tgAppJyGate();
  var t = tgAppTrip(args), build = tgAppJyBuild(args), base = tgAppJyKey(args, 'base'), mix = args.mix;
  if (mix !== undefined && mix !== null && !isPlainObject(mix)) tgAppRefuse(400, 'bad_args', { field: 'mix' });
  if (isPlainObject(mix) && Object.keys(mix).length > TG_JY.MAX_DAYS) tgAppRefuse(400, 'too_many', { field: 'mix', max: TG_JY.MAX_DAYS });
  var choice = { base: base };
  if (isPlainObject(mix)) choice.mix = mix;
  var r = tgJyDoChoose(t.slug, build, choice);
  if (!r.ok) return tgAppJyNo(r);
  var rec = tgJyOutlineGet(t.slug, build);
  return tgAppOk({ request_id: r.request_id, via: r.via, choice: rec && rec.choice ? { base: rec.choice.base, mix: rec.choice.mix || {} } : null });
}
/** versions.get { slug, date } — that date's versions, whether the day is planned, and whether a choice replaces it. */
function tgAppOpVersionsGet(args) {
  tgAppJyGate();
  var t = tgAppTrip(args), date = tgAppJyDate(args, 'date');
  if (tgJyTripDates(t).indexOf(date) < 0 && !tgDigestDay(t.slug, date)) tgAppRefuse(404, 'no_day');
  var rec = tgJyShownVersions(t.slug, date);
  if (!rec) tgAppRefuse(404, 'no_versions', { text: TG_JY_WHY.no_versions });
  return tgAppOk({ date: date, planned: !!tgDigestDay(t.slug, date), replace: tgJyReplaceMode(t.slug, date),
    current: !!tgJyCurrent(t.slug, date), versions: tgAppJyVersions(rec) });
}
/** versions.choose { slug, build_id, date, key, replace? } — choose (the current set only), or replace a planned day. */
function tgAppOpVersionsChoose(args) {
  tgAppJyGate();
  var t = tgAppTrip(args), build = tgAppJyBuild(args), date = tgAppJyDate(args, 'date'), key = tgAppJyKey(args, 'key');
  var replace = tgAppBool(args, 'replace', false);
  var r = replace ? tgJyDoReplace(t.slug, build, date, key) : tgJyDoPick(t.slug, build, date, key);
  if (!r.ok) return tgAppJyNo(r);
  if (replace) return tgAppOk({ replaced: true, request_id: r.request_id });
  var st = tgJyState(t.slug);
  return tgAppOk({ date: date, key: r.rec.key, have: st.have, missing: st.missing.slice(), can_build: tgAppJyStage(t.slug, st).can_build });
}
/** versions.done { slug } — 🧱 Build my plan: the plan request with the outline and the chosen versions. */
function tgAppOpVersionsDone(args) {
  tgAppJyGate();
  var t = tgAppTrip(args), r = tgJyDoBuild(t.slug);
  if (!r.ok) return tgAppJyNo(r);
  return tgAppOk({ started: true, request_id: r.request_id, via: r.via, missing: r.missing });
}

TG_APP_OPS['journey.get'] = { args: ['slug'], fn: tgAppOpJourneyGet };
TG_APP_OPS['outline.choose'] = { args: ['slug', 'build_id', 'base', 'mix'], write: true, fn: tgAppOpOutlineChoose };
TG_APP_OPS['versions.get'] = { args: ['slug', 'date'], fn: tgAppOpVersionsGet };
TG_APP_OPS['versions.choose'] = { args: ['slug', 'build_id', 'date', 'key', 'replace'], write: true, fn: tgAppOpVersionsChoose };
TG_APP_OPS['versions.done'] = { args: ['slug'], write: true, fn: tgAppOpVersionsDone };

// Developed by: LightAISolutions
