/**
 * Tour Guide planner — per-leg buffers and the day's spare time (Phase 10, WP-10b). A buffer is slack the schedule adds
 * after a leg before the next item starts (finding the entrance, a missed train, catching breath after a climb). The
 * return leg to the lodging has none: nothing waits on it. A booking keeps its time: the buffer before a booked stop
 * shrinks to the slack there is (planner-day.mjs). Numbers are a default picked for this phase (decisions/WP-10b.md).
 *   bufferFor({ mode, minutes, transfers, flags }) → minutes (0–BUFFER.MAX)
 */
export const BUFFER = Object.freeze({
  WALK_SHORT: 2,        // a walk of ≤ 10 minutes
  WALK_SHORT_MAX: 10,
  WALK_MEDIUM: 3,       // ≤ 25 minutes
  WALK_MEDIUM_MAX: 25,
  WALK_LONG: 5,
  TRANSIT: 5,           // plus TRANSFER per change of line
  TRANSFER: 5,
  DRIVE: 5,             // parking, the last few hundred metres
  CLIMB: 5,             // uphill or on a trail
  MAX: 15
});

export function bufferFor(leg) {
  if (!leg || !(leg.minutes < Infinity)) return 0;
  const B = BUFFER;
  let b;
  if (leg.mode === 'WALK') b = leg.minutes <= B.WALK_SHORT_MAX ? B.WALK_SHORT : leg.minutes <= B.WALK_MEDIUM_MAX ? B.WALK_MEDIUM : B.WALK_LONG;
  else if (leg.mode === 'TRANSIT') b = B.TRANSIT + B.TRANSFER * Math.max(0, leg.transfers || 0);
  else b = B.DRIVE;
  const flags = leg.flags || [];
  if (flags.includes('uphill') || flags.includes('trail')) b += B.CLIMB;
  return Math.min(B.MAX, b);
}

// Developed by: LightAISolutions
