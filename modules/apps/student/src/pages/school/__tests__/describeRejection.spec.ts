import { SyncRejectionReasons } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { enBundle, ruBundle } from '@/shared/i18n'

import { describeRejection } from '../model'

describe('why the school did not take the request', () => {
  it.each(SyncRejectionReasons)('says %s in both languages', (reason) => {
    const said = describeRejection(reason)

    expect(enBundle.hasMessage(said)).toBe(true)
    expect(ruBundle.hasMessage(said)).toBe(true)
  })

  it('tells the reasons apart, so one message does not stand for all of them', () => {
    const said = SyncRejectionReasons.map(describeRejection)

    expect(new Set(said).size).toBe(SyncRejectionReasons.length)
  })
})
