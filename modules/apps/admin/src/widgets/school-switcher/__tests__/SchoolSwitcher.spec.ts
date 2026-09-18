import type { SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { resetSchoolNames } from '@/features/switch-school'
import { setAppRouter, useCurrentSchool } from '@/shared/access'
import { httpClientKey, HttpError, resetApi } from '@/shared/api'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import SchoolSwitcher from '../ui/SchoolSwitcher.vue'

const school = (value: string) => value as unknown as SchoolId

const SCHOOL_A = school('11111111-1111-1111-1111-111111111111')
const SCHOOL_B = school('22222222-2222-2222-2222-222222222222')

const SCHOOLS = '/edu/schools'

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (ids: SchoolId[]) =>
  useSession().start({
    accessToken: token(ids.map((sid) => ({ sid, p: ['*'] }))),
    refreshToken: 'refresh',
  })

const blank = { template: '<div />' }

// The school is the first segment of the address, so the switcher navigates.
// Two screens are enough: a section's list and one record of it.
const addressing = async (schoolId: SchoolId, at = 'courses'): Promise<Router> => {
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

const mountSwitcher = (answers: Record<string, unknown>) => {
  const transport = fakeHttpClient(answers)
  const switcher = mountWithApp(SchoolSwitcher, {
    global: { provide: { [httpClientKey as symbol]: transport.client } },
  })
  return { transport, switcher }
}

const namesAnswer = {
  [SCHOOLS]: {
    items: [
      { id: SCHOOL_A, name: 'First School' },
      { id: SCHOOL_B, name: 'Second School' },
    ],
  },
}

describe('SchoolSwitcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    resetApi()
    resetSchoolNames()
    useSession().end()
    setAppRouter(undefined)
  })

  it('shows no switcher when the token grants one school', async () => {
    signIn([SCHOOL_A])
    const { switcher } = mountSwitcher(namesAnswer)
    await flushPromises()

    expect(switcher.find('select').exists()).toBe(false)
    expect(switcher.text()).toContain('First School')
  })

  it('offers every school the token grants, and only those', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const { switcher } = mountSwitcher({
      [SCHOOLS]: {
        items: [
          { id: SCHOOL_A, name: 'First School' },
          { id: SCHOOL_B, name: 'Second School' },
          { id: school('33333333-3333-3333-3333-333333333333'), name: 'Not Mine' },
        ],
      },
    })
    await flushPromises()

    const options = switcher.findAll('option')

    expect(options).toHaveLength(2)
    expect(options.map((option) => option.text())).toEqual(['First School', 'Second School'])
  })

  it('changes the current school, and with it what is allowed', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    await addressing(SCHOOL_A)
    const { switcher } = mountSwitcher(namesAnswer)
    await flushPromises()

    await switcher.find('select').setValue(SCHOOL_B)
    await flushPromises()

    expect(useCurrentSchool().schoolId.value).toBe(SCHOOL_B)
  })

  it('stays on the screen and changes the school in the address', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const router = await addressing(SCHOOL_A)
    const { switcher } = mountSwitcher(namesAnswer)
    await flushPromises()

    await switcher.find('select').setValue(SCHOOL_B)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('courses')
    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/courses`)
  })

  it('leaves a record for its section index, the record being of the school left', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const router = await addressing(SCHOOL_A, 'course-edit')
    const { switcher } = mountSwitcher(namesAnswer)
    await flushPromises()

    await switcher.find('select').setValue(SCHOOL_B)
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe(`/s/${SCHOOL_B}/courses`)
  })

  it('marks the loaded lists stale when the school changes', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    await addressing(SCHOOL_A)
    const { switcher } = mountSwitcher(namesAnswer)
    await flushPromises()
    const before = useCurrentSchool().generation.value

    await switcher.find('select').setValue(SCHOOL_B)
    await flushPromises()

    expect(useCurrentSchool().generation.value).toBeGreaterThan(before)
  })

  it('falls back to the id when the operator may not read the school list', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const { switcher } = mountSwitcher({
      [SCHOOLS]: new HttpError(403, SCHOOLS, { message: 'Forbidden' }),
    })
    await flushPromises()

    expect(switcher.findAll('option').map((option) => option.text())).toEqual([SCHOOL_A, SCHOOL_B])
  })

  it('asks for the school names once, not once per render', async () => {
    signIn([SCHOOL_A, SCHOOL_B])
    const { transport, switcher } = mountSwitcher(namesAnswer)
    await flushPromises()

    mountWithApp(SchoolSwitcher, {
      global: { provide: { [httpClientKey as symbol]: transport.client } },
    })
    await flushPromises()

    expect(transport.callsTo(SCHOOLS)).toHaveLength(1)
    switcher.unmount()
  })
})
