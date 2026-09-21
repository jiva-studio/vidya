import { EnrollmentStatuses } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { describePlace } from '../describePlace'

describe('saying where a place stands', () => {
  it('gives every status a word of its own', () => {
    const keys = EnrollmentStatuses.map((status) => describePlace(status).key)

    expect(new Set(keys).size).toBe(EnrollmentStatuses.length)
  })

  it('does not tell a student they were refused when they left themselves', () => {
    expect(describePlace('withdrawn').key).not.toBe(describePlace('declined').key)
    expect(describePlace('withdrawn').tone).not.toBe(describePlace('declined').tone)
  })

  it('marks a place still being decided as neither given nor refused', () => {
    expect(describePlace('pending').tone).toBe('warning')
    expect(describePlace('accepted').tone).toBe('success')
  })
})
