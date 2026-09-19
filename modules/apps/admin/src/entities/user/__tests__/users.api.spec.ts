import type { RoleId, SchoolId, UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { useSession } from '@/shared/session'
import { addressSchool, fakeHttpClient, mountWithApp } from '@/shared/testing'

import { userApi, useUserApi } from '../api'

const first = asId<SchoolId>('school-1')
const second = asId<SchoolId>('school-2')
const user = asId<UserId>('user-1')
const role = asId<RoleId>('role-1')

const answers = {
  '/edu/users': { items: [] },
  '/edu/users/user-1': { id: user, name: 'Ann', email: 'ann@example.com', roles: [] },
  '/edu/users/user-1/roles': { userRoles: [] },
  '/edu/users/user-1/schools': { userSchools: [] },
}

const token = (schools: SchoolId[]) =>
  `header.${btoa(
    JSON.stringify({
      sub: 'u1',
      exp: 2_000_000_000,
      permissions: schools.map((sid) => ({ sid, p: ['*'] })),
    }),
  )}.sig`

/** Mounts nothing but the composable, so the injection under test is the real one. */
const inContext = (transport: ReturnType<typeof fakeHttpClient>) => {
  let api: ReturnType<typeof useUserApi> | undefined

  const Probe = defineComponent({
    setup() {
      api = useUserApi()
      return () => h('div')
    },
  })

  mountWithApp(Probe, { global: { provide: { [httpClientKey as symbol]: transport.client } } })

  if (!api) throw new Error('the probe did not run')
  return api
}

describe('userApi', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
  })

  it('narrows the list to one school through the query', async () => {
    const transport = fakeHttpClient(answers)

    await userApi(transport.client).list(first)

    expect(transport.calls[0]).toEqual({
      method: 'GET',
      path: '/edu/users',
      query: { schoolId: first },
    })
  })

  it('sets the whole set of roles, because that is what the API takes', async () => {
    const transport = fakeHttpClient({ ...answers, 'POST /edu/users/user-1/roles': {} })

    await userApi(transport.client).setRoles(user, [role])

    expect(transport.calls[0]).toEqual({
      method: 'POST',
      path: '/edu/users/user-1/roles',
      body: { roleIds: [role] },
    })
  })

  it('reads the roles and the schools of one person from their own resources', async () => {
    const transport = fakeHttpClient(answers)
    const api = userApi(transport.client)

    await api.roles(user)
    await api.schools(user)

    expect(transport.calls.map((call) => call.path)).toEqual([
      '/edu/users/user-1/roles',
      '/edu/users/user-1/schools',
    ])
  })

  it('takes the school at the moment of the call, not the one it was built with', async () => {
    useSession().start({ accessToken: token([first, second]), refreshToken: 'r' })
    await addressSchool(first)

    const transport = fakeHttpClient(answers)
    const api = inContext(transport)

    await api.list()
    useCurrentSchool().select(second)
    await flushPromises()
    await api.list()

    expect(transport.calls.map((call) => call.query)).toEqual([
      { schoolId: first },
      { schoolId: second },
    ])
  })
})
