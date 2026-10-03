/**
 * Tour Guide planner — checkDayChain(day): the leg chain and timeline of a Phase 11 DayPlan (WP-11a; Contract C11).
 * WP-11a wrote the rule here and offered it to the schema checks; at the Phase 11 merge it moved into
 * schemas/tour-guide-checks.mjs, where checkDayPlan runs it on every day (one rule, next to the other plan checks).
 * The planner keeps this name for its callers and tests.
 *   checkDayChain(day) → [{ path, message }]
 */
export { checkDayChain } from '../schemas/tour-guide-checks.mjs';

// Developed by: LightAISolutions
