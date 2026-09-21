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

  it('builds the link on the site the console is a subdomain of', () => {
    expect(buildJoiningLink('AB3K7Q', 'https://admin.school.ru')).toBe('https://school.ru/j/AB3K7Q')
  })

  it('keeps the scheme and the port the console is served on', () => {
    expect(buildJoiningLink('AB3K7Q', 'http://admin.school.ru:8443')).toBe(
      'http://school.ru:8443/j/AB3K7Q',
    )
  })

  it('normalises the code on a link built from the console address too', () => {
    expect(buildJoiningLink('ab3k7q', 'https://admin.school.ru')).toBe('https://school.ru/j/AB3K7Q')
  })

  it('falls back to the configured site for a console the naming does not fit', () => {
    expect(buildJoiningLink('AB3K7Q', 'https://console.example.org')).toBe(
      'http://localhost:7814/j/AB3K7Q',
    )
  })

  it('falls back for a development console served on a bare host', () => {
    expect(buildJoiningLink('AB3K7Q', 'http://localhost:7813')).toBe(
      'http://localhost:7814/j/AB3K7Q',
    )
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
