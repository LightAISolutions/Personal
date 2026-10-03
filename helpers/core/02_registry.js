/**
 * Helpers core — extension registries. The ONLY way a pack extends the core.
 * Pack files (helpers/packs/<name>/gas/*.js) call these at load time (top-level statements); core files load first,
 * so the registry always exists. Duplicate registration throws — ownership conflicts must be visible, not silent.
 */
var HB_REGISTRY = {
  envelope: {},   // type -> { validate(payload)->string[], handle(envelope)->any }
  action: {},     // type -> { validate(payload)->string[], preview(payload)->html, execute(payload, ctx)->result }
  command: {},    // '/cmd' -> fn(ctx)
  callback: {},   // 'prefix' -> fn(ctx)
  message: {},    // name -> fn(ctx)->true|false   (free text; first handler returning true wins)
  queue: {},      // kind -> fn(item)->result
  daily: {},      // name -> fn()                  (runs once per local day, during the first sweep of the day)
  setup: {},      // name -> { label, description, run()->string }
  sheet: {},      // sheetName -> headers[]
  snapshot: {},   // name -> fn()->object          (contributes to to-brain/state.json)
  renderer: {},   // name -> fn(payload)->html
  proposal_guard: {}, // name -> fn(env, proposal) -> null | string reason
  observer: {},   // name -> fn(env, result)       (after an envelope was handled successfully)
  flow: {},       // name -> { start(seed, ctx), next(state, input, ctx), onDone?(state, ctx), ttl_min? } (15_flows.js)
  route: {},      // name -> { methods: ['GET'|'POST'], auth: 'none'|'admin'|'webapp', handler(req) -> { status, body } } (10_router.js)
  help: []        // lines shown by /help
};
/** Route names the core owns. registerRoute() refuses them at load time and the router never looks them up in the registry. */
var CORE_ROUTES = ['tg', 'wake', 'setup', 'health', 'upload'];

function _regPut(bucket, key, value, what) {
  if (!key || typeof key !== 'string') throw new Error('register' + what + ': key must be a non-empty string');
  if (Object.prototype.hasOwnProperty.call(HB_REGISTRY[bucket], key)) throw new Error('register' + what + ': duplicate "' + key + '"');
  HB_REGISTRY[bucket][key] = value;
  return value;
}
function _regFn(fn, what) { if (typeof fn !== 'function') throw new Error(what + ': handler must be a function'); return fn; }

/** registerEnvelopeHandler(type, fn | {validate, handle}). type must be in ENVELOPE_TYPES (core + manifest). */
function registerEnvelopeHandler(type, handler) {
  if (ENVELOPE_TYPES.indexOf(type) < 0) throw new Error('registerEnvelopeHandler: unknown envelope type "' + type + '" (add it to helper.json envelope_types)');
  var h = typeof handler === 'function' ? { handle: handler } : handler;
  if (!h || typeof h.handle !== 'function') throw new Error('registerEnvelopeHandler: need handle(envelope)');
  if (h.validate && typeof h.validate !== 'function') throw new Error('registerEnvelopeHandler: validate must be a function');
  return _regPut('envelope', type, h, 'EnvelopeHandler');
}
/** registerAction(type, {validate, preview, execute}). type must be in ACTION_ALLOWLIST (core + manifest). */
function registerAction(type, def) {
  if (ACTION_ALLOWLIST.indexOf(type) < 0) throw new Error('registerAction: "' + type + '" is not in ACTION_ALLOWLIST (add it to helper.json action_allowlist)');
  if (!def || typeof def.validate !== 'function' || typeof def.preview !== 'function' || typeof def.execute !== 'function') {
    throw new Error('registerAction: need {validate, preview, execute}');
  }
  return _regPut('action', type, def, 'Action');
}
/** registerCommand('/cmd', fn(ctx), helpLine); ctx = {chatId, from, text, args, argv, message, reply(html, opts)} */
function registerCommand(cmd, fn, helpLine) {
  if (!/^\/[a-z0-9_]{1,31}$/.test(cmd || '')) throw new Error('registerCommand: bad command "' + cmd + '"');
  _regPut('command', cmd, _regFn(fn, 'registerCommand'), 'Command');
  if (helpLine) HB_REGISTRY.help.push(cmd + ' — ' + helpLine);
  return fn;
}
/** registerCallback('prefix', fn(ctx)); ctx = {chatId, from, data, parts, messageId, callbackQuery, answer(text, alert), edit(html, keyboard)} */
function registerCallback(prefix, fn) {
  if (!/^[a-z][a-z0-9]{0,7}$/.test(prefix || '')) throw new Error('registerCallback: prefix must match /^[a-z][a-z0-9]{0,7}$/');
  return _regPut('callback', prefix, _regFn(fn, 'registerCallback'), 'Callback');
}
/**
 * registerMessageHandler(name, fn(ctx)) — owner free text (not a command). Handlers run in name order; the first one
 * that returns true has handled the message. When none does, the core opens a request for the inbound routine.
 */
function registerMessageHandler(name, fn) { return _regPut('message', name, _regFn(fn, 'registerMessageHandler'), 'MessageHandler'); }
/** registerQueueHandler(kind, fn(item)) — item = {id, kind, source, payload, attempts, created_at} */
function registerQueueHandler(kind, fn) {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(kind || '')) throw new Error('registerQueueHandler: bad kind "' + kind + '"');
  return _regPut('queue', kind, _regFn(fn, 'registerQueueHandler'), 'QueueHandler');
}
/** registerDailyJob(name, fn) — housekeeping, run once per local day by the first sweep of that day (no permanent trigger). */
function registerDailyJob(name, fn) { return _regPut('daily', name, _regFn(fn, 'registerDailyJob'), 'DailyJob'); }
/** registerSetupStep(name, {label, description, run()->string}) — extra button on the owner setup page. */
function registerSetupStep(name, def) {
  if (!def || typeof def.run !== 'function' || !def.label) throw new Error('registerSetupStep: need {label, run}');
  return _regPut('setup', name, def, 'SetupStep');
}
/** registerSheet(name, headers[]) — extra tab created by ensureSheets(); may also add columns to a core tab. */
function registerSheet(name, headers) {
  if (!Array.isArray(headers) || !headers.length) throw new Error('registerSheet: headers[] required');
  if (Object.prototype.hasOwnProperty.call(HB_REGISTRY.sheet, name)) {
    HB_REGISTRY.sheet[name] = HB_REGISTRY.sheet[name].concat(headers.filter(function (h) { return HB_REGISTRY.sheet[name].indexOf(h) < 0; }));
    return HB_REGISTRY.sheet[name];
  }
  HB_REGISTRY.sheet[name] = headers.slice();
  return HB_REGISTRY.sheet[name];
}
/** registerSnapshotProvider(name, fn()->object) — merged into to-brain/state.json under that name. */
function registerSnapshotProvider(name, fn) { return _regPut('snapshot', name, _regFn(fn, 'registerSnapshotProvider'), 'SnapshotProvider'); }
/** registerRenderer(name, fn(payload)->html) — shared HTML renderers other pack files may reuse. */
function registerRenderer(name, fn) { return _regPut('renderer', name, _regFn(fn, 'registerRenderer'), 'Renderer'); }
function registerHelp(line) { HB_REGISTRY.help.push(String(line)); }
/**
 * registerProposalGuard(name, fn(env, proposal) -> null | string) — runs inside the core `proposal` handler BEFORE
 * proposeAction(). A non-empty string refuses the proposal (audited `proposal_refused`, envelope archived as processed).
 */
function registerProposalGuard(name, fn) { return _regPut('proposal_guard', name, _regFn(fn, 'registerProposalGuard'), 'ProposalGuard'); }
/** registerEnvelopeObserver(name, fn(env, result)) — after ANY envelope handler returned without throwing. */
function registerEnvelopeObserver(name, fn) { return _regPut('observer', name, _regFn(fn, 'registerEnvelopeObserver'), 'EnvelopeObserver'); }

/**
 * registerRoute(name, { methods, auth, handler, lock? }) — an extra `?route=<name>` on the web app (10_router.js).
 * methods ⊆ ['GET','POST'] (non-empty); auth: 'none' | 'admin' (?k=ADMIN_SECRET) | 'webapp' (Telegram Mini App initData in
 * the POST body `{ initData, op, args }`, verified against BOT_TOKEN and OWNER_CHAT_ID before the handler runs — POST only);
 * handler(req) → { status, body } with req = { method, params, body, user, auth_date, start_param }. The router serialises
 * `body` as JSON. Core route names (CORE_ROUTES) cannot be registered — the throw is the bundle-time refusal.
 * lock: true runs every call under the script lock (like a Telegram update); a function (req) → boolean decides per call
 * (a throwing predicate locks). Taken after auth and the daily cap; held elsewhere for LIMITS.ROUTE_LOCK_WAIT_MS → 503 busy.
 */
function registerRoute(name, def) {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name || '')) throw new Error('registerRoute: name must match /^[a-z][a-z0-9_-]{0,31}$/');
  if (CORE_ROUTES.indexOf(name) >= 0) throw new Error('registerRoute: "' + name + '" is a core route and cannot be overridden');
  if (!def || typeof def.handler !== 'function') throw new Error('registerRoute: need { methods, auth, handler }');
  var methods = Array.isArray(def.methods) ? def.methods.map(String) : [];
  if (!methods.length || methods.some(function (m) { return m !== 'GET' && m !== 'POST'; })) throw new Error('registerRoute: methods must be a non-empty subset of [GET, POST]');
  if (['none', 'admin', 'webapp'].indexOf(def.auth) < 0) throw new Error('registerRoute: auth must be none | admin | webapp');
  if (def.auth === 'webapp' && (methods.length !== 1 || methods[0] !== 'POST')) throw new Error('registerRoute: auth "webapp" routes are POST only (initData travels in the body)');
  if (def.lock !== undefined && def.lock !== true && def.lock !== false && typeof def.lock !== 'function') throw new Error('registerRoute: lock must be true, false or function (req) → boolean');
  return _regPut('route', name, { methods: methods.slice(), auth: def.auth, handler: def.handler, lock: def.lock || false }, 'Route');
}

/** Own properties only — `constructor`, `__proto__`, `toString`… from a request must never resolve to an inherited member. */
function _regGet(bucket, key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(HB_REGISTRY[bucket], key) ? HB_REGISTRY[bucket][key] : null;
}
function getEnvelopeHandler(type) { return _regGet('envelope', type); }
function getActionDef(type) { return _regGet('action', type); }
function getCommand(cmd) { return _regGet('command', cmd); }
function getCallback(prefix) { return _regGet('callback', prefix); }
function getQueueHandler(kind) { return _regGet('queue', kind); }
function getRenderer(name) { return _regGet('renderer', name); }
function getRoute(name) { return CORE_ROUTES.indexOf(name) >= 0 ? null : _regGet('route', name); }
function registryKeys(bucket) { return Object.keys(HB_REGISTRY[bucket] || {}).sort(); }

// Developed by: LightAISolutions
