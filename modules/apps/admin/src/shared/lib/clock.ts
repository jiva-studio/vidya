/**
 * Delayed work as a port, because pure layers may not call `setTimeout`: a
 * hidden timer can only be tested by waiting for it, and waiting is flaky.
 */

export type Scheduled = { readonly cancel: () => void }

export interface Clock {
  schedule(work: () => void, delayMs: number): Scheduled
}

export const systemClock: Clock = {
  schedule: (work, delayMs) => {
    const handle = setTimeout(work, delayMs)
    return { cancel: () => clearTimeout(handle) }
  },
}

/** A clock whose time only moves when a test or a story moves it. */
export const manualClock = () => {
  let pending: { work: () => void; at: number }[] = []
  let elapsed = 0

  const schedule = (work: () => void, delayMs: number): Scheduled => {
    const entry = { work, at: elapsed + delayMs }
    pending.push(entry)
    return { cancel: () => (pending = pending.filter((held) => held !== entry)) }
  }

  const advance = (ms: number): void => {
    elapsed += ms
    const due = pending.filter((entry) => entry.at <= elapsed)
    pending = pending.filter((entry) => entry.at > elapsed)
    for (const entry of due) entry.work()
  }

  return {
    schedule,
    advance,
    get pending() {
      return pending.length
    },
  }
}
