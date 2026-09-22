import { describe, expect, it, vi } from 'vitest'

import { electWriter } from '../writerElection'

/**
 * A stand-in for `navigator.locks` with the one behaviour under test: one
 * holder at a time, `ifAvailable` answering `null` instead of waiting, and the
 * queue moving on when the holder lets go.
 */
const fakeLocks = () => {
  const held = new Set<string>()
  const waiting: { name: string; run: () => void }[] = []

  const release = (name: string) => {
    held.delete(name)
    const next = waiting.findIndex((entry) => entry.name === name)
    if (next === -1) return

    const [entry] = waiting.splice(next, 1)
    entry.run()
  }

  const take = async (name: string, callback: (lock: unknown) => unknown) => {
    held.add(name)
    try {
      return await callback({ name, mode: 'exclusive' })
    } finally {
      release(name)
    }
  }

  const request = (
    name: string,
    optionsOrCallback: unknown,
    maybeCallback?: (lock: unknown) => unknown,
  ): Promise<unknown> => {
    const callback = (maybeCallback ?? optionsOrCallback) as (lock: unknown) => unknown
    const options = (maybeCallback === undefined ? {} : optionsOrCallback) as {
      ifAvailable?: boolean
    }

    if (!held.has(name)) return take(name, callback)
    if (options.ifAvailable) return Promise.resolve(callback(null))

    return new Promise((resolve) => {
      waiting.push({ name, run: () => resolve(take(name, callback)) })
    })
  }

  return { locks: { request } as unknown as LockManager, holders: () => held.size }
}

const LOCK = 'writer'

describe('the one tab that writes', () => {
  it('lets the first tab write, and runs its work before saying so', async () => {
    const { locks } = fakeLocks()
    const order: string[] = []

    const election = electWriter({
      locks,
      name: LOCK,
      onElected: async () => {
        await Promise.resolve()
        order.push('prepared')
      },
    })

    await expect(election.writes).resolves.toBe(true)
    order.push('told')

    expect(order).toEqual(['prepared', 'told'])
  })

  it('refuses the second tab while the first is open', async () => {
    const { locks } = fakeLocks()
    const second = vi.fn()

    const first = electWriter({ locks, name: LOCK, onElected: () => {} })
    await first.writes

    const follower = electWriter({ locks, name: LOCK, onElected: second })

    await expect(follower.writes).resolves.toBe(false)
    expect(second).not.toHaveBeenCalled()
  })

  it('hands the role to a waiting tab when the writer lets go', async () => {
    const { locks } = fakeLocks()
    const second = vi.fn()

    const first = electWriter({ locks, name: LOCK, onElected: () => {} })
    await first.writes

    const follower = electWriter({ locks, name: LOCK, onElected: second })
    await follower.writes

    first.release()
    await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(1))
  })

  it('keeps the lock while the writer holds it, and only then gives it back', async () => {
    const { locks, holders } = fakeLocks()

    const election = electWriter({ locks, name: LOCK, onElected: () => {} })
    await election.writes

    expect(holders()).toBe(1)

    election.release()
    await vi.waitFor(() => expect(holders()).toBe(0))
  })

  it('writes anyway where the browser has no such lock', async () => {
    const elected = vi.fn()

    const election = electWriter({ locks: undefined, name: LOCK, onElected: elected })

    await expect(election.writes).resolves.toBe(true)
    expect(elected).toHaveBeenCalledTimes(1)
  })

  it('settles even when preparing the database fails inside the lock', async () => {
    const { locks } = fakeLocks()

    const election = electWriter({
      locks,
      name: LOCK,
      onElected: () => Promise.reject(new Error('no schema')),
    })

    await expect(election.writes).resolves.toBe(true)
  })
})
