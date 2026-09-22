/**
 * Wall-clock time as a port.
 *
 * The journal stamps a hybrid logical clock on every row it writes, and an HLC
 * is only testable if the physical half can be moved by hand. A process that
 * writes the journal supplies its own reading of the wall clock; nothing here
 * reaches for one.
 *
 * The unit is milliseconds since the Unix epoch, which is UTC by definition: no
 * local time, no offsets, nothing that a timezone change can shift.
 */
export interface Clock {
  nowMs(): number
}
