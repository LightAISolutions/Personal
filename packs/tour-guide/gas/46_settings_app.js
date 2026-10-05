/**
 * Tour Guide Settings in the app (Phase 17b, item 5): what the owner's switches are set to and how the helper is doing,
 * added to TG_APP_OPS (32_app_api.js) from this file:
 *   settings.get → { journey, smart: { wanted, key_set, on, today: { answered, tokens, usd } }, morning: { on, at },
 *                    whatson_auto, lists_auto, display: { clock, temp }, profile: { has, updated, dimensions },
 *                    status: { …coreStatusCounts() } }   (display: the brochure units, /units, 47_units.js)
 * Read only. The app changes a switch by running its command (commands.run, 45_commands_app.js), e.g. '/journey off' or
 * '/morning at 07:30', so the chat keeps the same record and the same answer as a typed command; then it reads this again.
 * No secrets: only whether the API key is set, never its value. Defaults: helpers/decisions/TG-PHASE-17.md.
 */
function tgAppOpSettings() {
  var smart = null;
  if (typeof tgChatWanted === 'function') {
    var u = typeof tgChatUsageDay === 'function' ? tgChatUsageDay(isoDateIn(getTz())) : {};
    var wanted = tgChatWanted(), key = tgChatKeySet();
    smart = { wanted: wanted, key_set: key, on: wanted === 'on' && key,
      today: { answered: u.answered || 0, tokens: (u['in'] || 0) + (u.out || 0), usd: Math.round((u.usd || 0) * 100) / 100 } };
  }
  var prof = typeof tgProfileSummaryGet === 'function' ? tgProfileSummaryGet() : null;
  return tgAppOk({
    journey: typeof tgJyOn === 'function' ? tgJyOn() : false,
    smart: smart,
    morning: typeof tgMorningCfg === 'function' ? tgMorningCfg() : null,
    whatson_auto: typeof TG_WHATSON === 'object' ? settingGet(TG_WHATSON.SET_AUTO, '') !== 'off' : null,
    lists_auto: typeof TG_LISTS === 'object' ? settingGet(TG_LISTS.SET_AUTO, '') !== 'off' : null,
    display: typeof tgUnits === 'function' ? tgUnits() : null,
    profile: { has: !!prof, updated: prof ? tgShDate(prof.updated || prof.received_at) : '',
      dimensions: prof && typeof prof.dimensions_count === 'number' ? prof.dimensions_count : null },
    status: coreStatusCounts()
  });
}
TG_APP_OPS['settings.get'] = { args: [], fn: tgAppOpSettings };

// Developed by: LightAISolutions
