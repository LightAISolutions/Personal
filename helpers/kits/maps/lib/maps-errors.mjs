/**
 * Maps kit — typed errors. Every failure the kit raises carries a stable `code` so callers (planner, skills) can branch
 * on it without parsing messages. Messages never contain an API key or a request header.
 */
export class MapsError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'MapsError';
    this.code = code;
    Object.assign(this, detail);
  }
}
/** The SKU counter refused the call: it would push `sku` past its monthly ceiling. Nothing was sent. */
export class MapsBudgetError extends MapsError {
  constructor(sku, month, used, units, ceiling) {
    super('SKU_CEILING', `maps: ${sku} would reach ${used + units} of a ${ceiling} ceiling for ${month}; call refused before sending`, { sku, month, used, units, ceiling });
    this.name = 'MapsBudgetError';
  }
}
/** The caller asked for something the kit does not allow (unknown tier, transit with waypoints, too many elements…). */
export class MapsInputError extends MapsError {
  constructor(message, detail) { super('BAD_INPUT', message, detail); this.name = 'MapsInputError'; }
}
/** Google (or the egress proxy) answered with a non-2xx status, or the transport failed. */
export class MapsRequestError extends MapsError {
  constructor(code, message, detail) { super(code, message, detail); this.name = 'MapsRequestError'; }
}

// Developed by: LightAISolutions
