import type { SchoolId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { grants, hasExpired, readAccessToken, schoolsOf } from '../accessToken'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')
const SCHOOL_B = school('22222222-2222-2222-2222-222222222222')

const encode = (payload: unknown) =>
  `header.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.signature`

const token = (payload: Record<string, unknown>) =>
  encode({ sub: 'user-1', exp: 2_000_000_000, typ: 'access', ...payload })

describe('readAccessToken', () => {
  it('reads the subject, the expiry and the permissions', () => {
    const claims = readAccessToken(token({ permissions: [{ sid: SCHOOL_A, p: ['courses:read'] }] }))

    expect(claims).toEqual({
      sub: 'user-1',
      exp: 2_000_000_000,
      permissions: [{ sid: SCHOOL_A, p: ['courses:read'] }],
    })
  })

  it('treats a token with no permissions claim as holding none', () => {
    expect(readAccessToken(token({}))?.permissions).toEqual([])
  })

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['a string that is not a token', 'not-a-token'],
    ['a token whose payload is not base64', 'header.!!!.signature'],
    ['a token whose payload is not an object', encode('hello')],
    ['a token with no subject', encode({ exp: 1 })],
  ])('reads %s as no session', (_case, value) => {
    expect(readAccessToken(value as string | undefined)).toBeUndefined()
  })

  it('decodes a payload that needs base64url padding', () => {
    const claims = readAccessToken(token({ permissions: [], name: 'ab' }))
    expect(claims?.sub).toBe('user-1')
  })
})

describe('hasExpired', () => {
  it('counts an absent token as expired', () => {
    expect(hasExpired(undefined, 0)).toBe(true)
  })

  it('counts a token whose second has arrived as expired', () => {
    const claims = readAccessToken(token({ exp: 1000 }))
    expect(hasExpired(claims, 1000)).toBe(true)
    expect(hasExpired(claims, 999)).toBe(false)
  })
})

describe('schoolsOf', () => {
  it('lists the schools in the order the token gives them', () => {
    expect(
      schoolsOf([
        { sid: SCHOOL_B, p: ['courses:read'] },
        { sid: SCHOOL_A, p: ['*'] },
      ]),
    ).toEqual([SCHOOL_B, SCHOOL_A])
  })

  it('lists nothing for a token that grants nothing', () => {
    expect(schoolsOf([])).toEqual([])
  })
})

describe('grants', () => {
  const permissions = [
    { sid: SCHOOL_A, p: ['courses:read' as const, 'courses:create' as const] },
    { sid: SCHOOL_B, p: ['*' as const] },
  ]

  it('allows what the current school grants', () => {
    expect(grants(permissions, SCHOOL_A, 'courses:create')).toBe(true)
  })

  it('refuses what only another school grants', () => {
    expect(grants(permissions, SCHOOL_A, 'homework:grade')).toBe(false)
  })

  it('allows everything where the role holds the star', () => {
    expect(grants(permissions, SCHOOL_B, 'homework:grade')).toBe(true)
  })

  it('refuses when no school is selected', () => {
    expect(grants(permissions, undefined, 'courses:read')).toBe(false)
  })

  it('refuses for a school the token says nothing about', () => {
    expect(grants(permissions, school('unknown-school'), 'courses:read')).toBe(false)
  })
})
