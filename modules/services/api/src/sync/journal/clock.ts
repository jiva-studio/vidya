import { Clock } from '@vidya/journal'

/** Nest injection token; `Clock` is an interface and erases at runtime. */
export const CLOCK = Symbol('SyncClock')

export const systemClock: Clock = {
  nowMs: () => Date.now(),
}
