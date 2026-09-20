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

  // Time moves to each piece of work in turn rather than to the end of the
  // window: work that re-arms itself — a countdown asking for the next second —
  // measures its delay from the moment it ran, as a real timer would.
  const advance = (ms: number): void => {
    const target = elapsed + ms

    for (;;) {
      const due = pending
        .filter((entry) => entry.at <= target)
        .sort((first, second) => first.at - second.at)

      const next = due[0]
      if (!next) break

      pending = pending.filter((entry) => entry !== next)
      elapsed = next.at
      next.work()
    }

    elapsed = target
  }

  return {
    schedule,
    advance,
    get pending() {
      return pending.length
    },
  }
}
