import type { SchoolId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useSession } from '../../session'
import { useCan } from '../useCan'
import { useCurrentSchool } from '../useCurrentSchool'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')
const SCHOOL_B = school('22222222-2222-2222-2222-222222222222')

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'user-1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.signature`

const signIn = (permissions: unknown) =>
  useSession().start({ accessToken: token(permissions), refreshToken: 'refresh' })

describe('useCan', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
    useCurrentSchool().select(SCHOOL_A)
  })

  it('allows a permission the current school grants', () => {
    signIn([{ sid: SCHOOL_A, p: ['courses:create'] }])

    expect(useCan('courses:create').value).toBe(true)
  })

  it('refuses a permission only another school grants', () => {
    signIn([
      { sid: SCHOOL_A, p: ['courses:read'] },
      { sid: SCHOOL_B, p: ['courses:create'] },
    ])

    expect(useCan('courses:create').value).toBe(false)
  })

  it('refuses a permission no school grants', () => {
    signIn([{ sid: SCHOOL_A, p: ['courses:read'] }])

    expect(useCan('homework:grade').value).toBe(false)
  })

  it('allows everything where the role holds the star', () => {
    signIn([{ sid: SCHOOL_A, p: ['*'] }])

    expect(useCan('lessons:publish').value).toBe(true)
    expect(useCan('enrollments:moderate').value).toBe(true)
  })

  it('changes its answer when the school changes', async () => {
    signIn([
      { sid: SCHOOL_A, p: ['courses:read'] },
      { sid: SCHOOL_B, p: ['homework:grade'] },
    ])
    const canGrade = useCan('homework:grade')
    expect(canGrade.value).toBe(false)

    useCurrentSchool().select(SCHOOL_B)
    await nextTick()

    expect(canGrade.value).toBe(true)
  })

  it('refuses everything once the session ends', () => {
    signIn([{ sid: SCHOOL_A, p: ['*'] }])
    const can = useCan('courses:read')
    expect(can.value).toBe(true)

    useSession().end()

    expect(can.value).toBe(false)
  })
})

describe('useCurrentSchool', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
  })

  it('falls back to the first school the token lists', () => {
    signIn([
      { sid: SCHOOL_B, p: ['courses:read'] },
      { sid: SCHOOL_A, p: ['courses:read'] },
    ])

    expect(useCurrentSchool().schoolId.value).toBe(SCHOOL_B)
  })

  it('offers no choice when the token lists one school', () => {
    signIn([{ sid: SCHOOL_A, p: ['*'] }])

    expect(useCurrentSchool().hasChoice.value).toBe(false)
  })

  it('offers a choice when the token lists more than one', () => {
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])

    expect(useCurrentSchool().hasChoice.value).toBe(true)
  })

  it('ignores a school the token does not grant', () => {
    signIn([{ sid: SCHOOL_A, p: ['*'] }])
    useCurrentSchool().select(SCHOOL_B)

    expect(useCurrentSchool().schoolId.value).toBe(SCHOOL_A)
  })

  it('marks loaded lists stale when the school changes', async () => {
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])
    const school = useCurrentSchool()
    school.select(SCHOOL_A)
    await nextTick()
    const before = school.generation.value

    school.select(SCHOOL_B)
    await nextTick()

    expect(school.generation.value).toBeGreaterThan(before)
  })
})
