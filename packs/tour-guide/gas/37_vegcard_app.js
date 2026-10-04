/**
 * Tour Guide veg card in the app (TG-PHASE-14 WP-14c): the op behind the full-screen Veg card view, added to TG_APP_OPS
 * (32_app_api.js) — no hook needed, the table is read at request time.
 *   vegcard.get { slug } → { trip, fp, received_at, card } (the stored payload: every line's local text and English), or
 *                          404 no_trip / no_vegcard. The app escapes every string; nothing comes from Google.
 */
function tgAppOpVegCard(args) {
  var t = tgAppTrip(args), rec = tgVegCardGet(t.slug);
  if (!rec) return tgAppNo(404, 'no_vegcard');
  return tgAppOk({ trip: t.slug, fp: rec.fp, received_at: rec.received_at, card: rec.card });
}
TG_APP_OPS['vegcard.get'] = { args: ['slug'], fn: tgAppOpVegCard };

// Developed by: LightAISolutions
