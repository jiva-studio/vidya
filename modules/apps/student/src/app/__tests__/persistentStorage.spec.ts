import { describe, expect, it, vi } from 'vitest'

import { requestPersistentStorage } from '../persistentStorage'

const manager = (persist: () => Promise<boolean>) => ({ persist }) as unknown as StorageManager

/**
 * Without this the browser may clear IndexedDB to make room, taking the outbox
 * — work the student saved and the server has never seen — with it. A refusal
 * is an answer, not a failure: the site goes on working with a weaker promise.
 */
describe('asking the browser to keep the local database', () => {
  it('says the data is kept when the browser grants it', async () => {
    await expect(requestPersistentStorage(manager(() => Promise.resolve(true)))).resolves.toBe(
      'persistent',
    )
  })

  it('says the data may be evicted when the browser refuses', async () => {
    await expect(requestPersistentStorage(manager(() => Promise.resolve(false)))).resolves.toBe(
      'temporary',
    )
  })

  it('promises nothing where the browser has no such api', async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBe('unknown')
    await expect(requestPersistentStorage({} as StorageManager)).resolves.toBe('unknown')
  })

  it('promises nothing, rather than failing, when the browser throws', async () => {
    const complained = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      requestPersistentStorage(manager(() => Promise.reject(new Error('denied')))),
    ).resolves.toBe('unknown')
    expect(complained).toHaveBeenCalled()

    complained.mockRestore()
  })
})
