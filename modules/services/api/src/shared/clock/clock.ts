/**
 * Wall-clock time as a port.
 *
 * `Date.now()` is a global with a lifetime no test controls, and two things in
 * this application turn on the exact instant they were called at: the hybrid
 * logical clock the journal stamps on every row, and the window a read
 * signature is rounded to. Both are only testable if the physical half can be
 * moved by hand, so the global lives behind this one seam.
 *
 * The unit is milliseconds since the Unix epoch, which is UTC by definition: no
 * local time, no offsets, nothing that a timezone change can shift.
 */
export interface Clock {
  nowMs(): number
}

/** Nest injection token; `Clock` is an interface and erases at runtime. */
export const CLOCK = Symbol('Clock')

export const systemClock: Clock = {
  nowMs: () => Date.now(),
}
