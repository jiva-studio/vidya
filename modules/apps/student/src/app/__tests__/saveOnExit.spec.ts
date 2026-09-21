import type { IDatabase } from '@vidya/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveOnExit } from '../saveOnExit'

const fakeDatabase = (save: () => Promise<void> = () => Promise.resolve()) =>
  ({ save: vi.fn(save) }) as unknown as IDatabase & { save: ReturnType<typeof vi.fn> }

const hide = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * A tab is never told it is about to die in time to await anything, which is
 * why both events are wired and why nothing is awaited.
 */
describe('writing the database out on the way out', () => {
  beforeEach(() => {
    hide('visible')
  })

  it('writes when the tab is hidden', () => {
    const db = fakeDatabase()
    saveOnExit(db)

    hide('hidden')

    expect(db.save).toHaveBeenCalledTimes(1)
  })

  it('writes when the page goes away', () => {
    const db = fakeDatabase()
    saveOnExit(db)

    window.dispatchEvent(new Event('pagehide'))

    expect(db.save).toHaveBeenCalledTimes(1)
  })

  it('does not write on every switch back to the tab', () => {
    const db = fakeDatabase()
    saveOnExit(db)

    hide('visible')

    expect(db.save).not.toHaveBeenCalled()
  })

  it('stops listening once the caller lets go', () => {
    const db = fakeDatabase()
    const stop = saveOnExit(db)

    stop()
    hide('hidden')
    window.dispatchEvent(new Event('pagehide'))

    expect(db.save).not.toHaveBeenCalled()
  })

  it('reports a write it could not finish instead of losing it in a rejection', async () => {
    const complained = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = fakeDatabase(() => Promise.reject(new Error('quota exceeded')))

    saveOnExit(db)
    window.dispatchEvent(new Event('pagehide'))
    await vi.waitFor(() => expect(complained).toHaveBeenCalled())

    complained.mockRestore()
  })
})
