/**
 * Wall-clock time as a port.
 *
 * The journal stamps a hybrid logical clock on every row it writes, and an HLC
 * is only testable if the physical half can be moved by hand. `Date.now()` is a
 * global with a lifetime no test controls, so it lives behind this one seam and
 * nowhere else in the sync module.
 *
 * The unit is milliseconds since the Unix epoch, which is UTC by definition: no
 * local time, no offsets, nothing that a timezone change can shift.
 */
export interface Clock {
  nowMs(): number
}

/** Nest injection token; `Clock` is an interface and erases at runtime. */
export const CLOCK = Symbol('SyncClock')

export const systemClock: Clock = {
  nowMs: () => Date.now(),
}
