/**
 * Tour Guide planner — the owner's shortlist choices. `input.choices = { picks, later, skip }` names places by slug:
 *   picks  — when non-empty, the whole pool: only picked places can enter a day; every other candidate stays
 *            `candidate`, enters no day and no Later list (the Plan records `choices`, so the check allows that);
 *   later  — kept for later: status `saved-for-later`, listed in "Saved by you" with code `owner_choice`;
 *   skip   — status `rejected`, in no day and no list.
 * Explicit choices (passed by the caller) are the owner's current word and override stored statuses: a pick is pooled
 * whatever its status. Recorded choices (replanDays falls back to `plan.choices`) only filter the pool: statuses set
 * since then win (a demoted pick stays out, a kept-for-later place stays listed). In both modes a place promoted from
 * a Later list (status `candidate` with `scheduled_hint`) joins the picks unless explicit choices keep or skip it.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const CHOICE_LISTS = Object.freeze(['picks', 'later', 'skip']);
/** Statuses the planner pools ("chosen" = picked from a shortlist). */
export const POOL_STATUSES = Object.freeze(['candidate', 'chosen', 'scheduled']);
export const OWNER_CHOICE_REASON = 'you kept this for later when choosing from the shortlist';
const fail = (m) => { throw new Error('planner: ' + m); };

/** normalizeChoices(choices, places) → null | { picks, later, skip } (deduplicated, input order); throws `planner:` errors. */
export function normalizeChoices(choices, places) {
  if (choices === undefined || choices === null) return null;
  if (typeof choices !== 'object' || Array.isArray(choices)) fail('choices must be an object { picks, later, skip }');
  const extra = Object.keys(choices).filter((k) => !CHOICE_LISTS.includes(k));
  if (extra.length) fail(`choices has unknown key(s) ${extra.join(', ')} (use picks, later, skip)`);
  const ids = new Set(places.map((p) => p && p.id));
  const out = {}, owner = new Map(), unknown = [];
  for (const name of CHOICE_LISTS) {
    const list = choices[name] === undefined ? [] : choices[name];
    if (!Array.isArray(list)) fail(`choices.${name} must be an array of place slugs`);
    out[name] = [];
    for (const slug of list) {
      if (typeof slug !== 'string' || !SLUG_RE.test(slug)) fail(`choices.${name} holds ${JSON.stringify(slug)}, not a place slug`);
      if (!ids.has(slug)) { if (!unknown.includes(slug)) unknown.push(slug); continue; }
      if (owner.has(slug)) {
        if (owner.get(slug) !== name) fail(`"${slug}" is in both choices.${owner.get(slug)} and choices.${name}`);
        continue;
      }
      owner.set(slug, name);
      out[name].push(slug);
    }
  }
  if (unknown.length) fail(`choices name unknown place(s): ${unknown.join(', ')}`);
  return out;
}

/**
 * applyChoices(places, choices, { explicit }) → { places (what prepare() pools), effective, picks, keep, skip, explicit }
 * `effective` is what the Plan records: the choices plus promoted places moved into picks.
 */
export function applyChoices(places, choices, { explicit }) {
  const promoted = places.filter((p) => p.status === 'candidate' && p.scheduled_hint).map((p) => p.id);
  const keep0 = new Set(choices.later), skip0 = new Set(choices.skip);
  const joins = promoted.filter((id) => !choices.picks.includes(id) && !(explicit && (keep0.has(id) || skip0.has(id))));
  const effective = {
    picks: [...choices.picks, ...joins],
    later: choices.later.filter((id) => !joins.includes(id)),
    skip: choices.skip.filter((id) => !joins.includes(id))
  };
  const picks = new Set(effective.picks), keep = new Set(effective.later), skip = new Set(effective.skip);
  const restrict = choices.picks.length > 0;
  const out = places.map((p) => {
    const pool = POOL_STATUSES.includes(p.status);
    if (picks.has(p.id)) return explicit || pool ? { ...p, status: 'chosen' } : p;
    if (keep.has(p.id) || skip.has(p.id)) return explicit ? { ...p, status: 'rejected' } : p;
    return restrict && pool ? { ...p, status: 'rejected' } : p;
  });
  return { places: out, effective, picks, keep, skip, explicit };
}

/** The status a place ends with in a Plan built with choices (scheduled_hint already removed in `rest`). */
export function choiceStatus(p, rest, { ch, scheduled, inLater }) {
  if (scheduled.has(p.id)) return { ...rest, status: 'scheduled' };
  if (ch.explicit && ch.skip.has(p.id)) return { ...rest, status: 'rejected' };
  if (ch.explicit && ch.keep.has(p.id)) return { ...rest, status: 'saved-for-later' };
  if (inLater.has(p.id)) return { ...rest, status: 'saved-for-later' };
  if (POOL_STATUSES.includes(p.status)) return { ...rest, status: 'candidate' };
  return rest;
}

// Developed by: LightAISolutions
