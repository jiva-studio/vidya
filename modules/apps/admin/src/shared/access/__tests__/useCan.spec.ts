import type { SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSession } from '../../session'
import { setAppRouter } from '../appRouter'
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

// The school is the first segment of the address, so a test that changes school
// changes the address. Two records: a section's index and one record of it.
const blank = { template: '<div />' }

const addressing = async (schoolId: SchoolId, at = 'courses') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/s/:schoolId', name: 'dashboard', component: blank },
      { path: '/s/:schoolId/courses', name: 'courses', component: blank },
      {
        path: '/s/:schoolId/courses/:courseId/edit',
        name: 'course-edit',
        component: blank,
        meta: { section: 'courses' },
      },
    ],
  })

  setAppRouter(router)
  await router.push({ name: at, params: { schoolId, courseId: 'c1' } })
  return router
}

describe('useCan', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
    setAppRouter(undefined)
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
    await addressing(SCHOOL_A)
    const canGrade = useCan('homework:grade')
    expect(canGrade.value).toBe(false)

    useCurrentSchool().select(SCHOOL_B)
    await flushPromises()

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
    setAppRouter(undefined)
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

  it('ignores a school the token does not grant', async () => {
    signIn([{ sid: SCHOOL_A, p: ['*'] }])
    const router = await addressing(SCHOOL_A)

    useCurrentSchool().select(SCHOOL_B)
    await flushPromises()

    expect(useCurrentSchool().schoolId.value).toBe(SCHOOL_A)
    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_A}/courses`)
  })

  it('reads the school out of the address', async () => {
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])
    await addressing(SCHOOL_B)

    expect(useCurrentSchool().schoolId.value).toBe(SCHOOL_B)
  })

  it('falls back to the first granted school when the address names an unknown one', async () => {
    signIn([{ sid: SCHOOL_A, p: ['*'] }])
    await addressing(school('99999999-9999-9999-9999-999999999999'))

    expect(useCurrentSchool().schoolId.value).toBe(SCHOOL_A)
  })

  it('stays on the screen when the school changes', async () => {
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])
    const router = await addressing(SCHOOL_A)

    useCurrentSchool().select(SCHOOL_B)
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/courses`)
  })

  it('leaves a record behind for its section index, which the other school has', async () => {
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])
    const router = await addressing(SCHOOL_A, 'course-edit')

    useCurrentSchool().select(SCHOOL_B)
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/courses`)
  })

  it('marks loaded lists stale when the school changes', async () => {
    signIn([
      { sid: SCHOOL_A, p: ['*'] },
      { sid: SCHOOL_B, p: ['*'] },
    ])
    await addressing(SCHOOL_A)
    const school = useCurrentSchool()
    const before = school.generation.value

    school.select(SCHOOL_B)
    await flushPromises()

    expect(school.generation.value).toBeGreaterThan(before)
  })
})
