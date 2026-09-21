import { beforeEach, describe, expect, it } from 'vitest'

import { LocalStorageDeviceId } from '../localStorageDeviceId'

/**
 * The id is the last tiebreak in a Hybrid Logical Clock and part of the key
 * the server deduplicates on, so an installation that mints a second one — or
 * two installations sharing one — loses writes to an index that thinks it has
 * seen them.
 */
describe('the id of this installation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('mints one and keeps it', async () => {
    const minted = await new LocalStorageDeviceId().current()

    expect(minted).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('vidya.student.deviceId')).toBe(minted)
  })

  it('answers the same id on every call, and after a reload', async () => {
    const first = await new LocalStorageDeviceId().current()

    expect(await new LocalStorageDeviceId().current()).toBe(first)
    expect(await new LocalStorageDeviceId().current()).toBe(first)
  })

  it('gives two installations two different ids', async () => {
    const first = await new LocalStorageDeviceId().current()
    localStorage.clear()

    expect(await new LocalStorageDeviceId().current()).not.toBe(first)
  })
})
