import { describe, expect, it } from 'vitest'

import { HttpError, OfflineError } from '@/shared/api'

import { buildJoiningLink, hasNoStudentRole } from '../model'

describe('buildJoiningLink', () => {
  it('points at the student site rather than at the console', () => {
    expect(buildJoiningLink('AB3K7Q')).toBe('http://localhost:7814/j/AB3K7Q')
  })

  it('hands out the code in the case a poster prints it in', () => {
    expect(buildJoiningLink('ab3k7q')).toBe('http://localhost:7814/j/AB3K7Q')
  })
})

describe('hasNoStudentRole', () => {
  it('reads a 409 as a school that takes no students yet', () => {
    expect(hasNoStudentRole(new HttpError(409, '/edu/schools/school-1/code'))).toBe(true)
  })

  it('leaves every other failure a failure', () => {
    expect(hasNoStudentRole(new HttpError(403, '/edu/schools/school-1/code'))).toBe(false)
    expect(hasNoStudentRole(new OfflineError('/edu/schools/school-1/code'))).toBe(false)
    expect(hasNoStudentRole(undefined)).toBe(false)
  })
})
