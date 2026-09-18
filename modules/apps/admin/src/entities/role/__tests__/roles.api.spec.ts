import type { PermissionKey, RoleId, SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '@/shared/testing'

import { roleApi } from '../api'

const school = asId<SchoolId>('school-1')
const role = asId<RoleId>('role-1')

const build = () => {
  const transport = fakeHttpClient({
    '/edu/roles': { items: [] },
    'POST /edu/roles': { id: role },
    'PATCH /edu/roles': { id: role },
    'DELETE /edu/roles': { success: true },
  })
  return { transport, api: roleApi(transport.client) }
}

describe('roleApi', () => {
  it('narrows the list to one school through the query', async () => {
    const { transport, api } = build()

    await api.list(school)

    expect(transport.calls[0]).toEqual({
      method: 'GET',
      path: '/edu/roles',
      query: { schoolId: school },
    })
  })

  it('leaves the school out rather than sending an empty one', async () => {
    const { transport, api } = build()

    await api.list(undefined)

    expect(transport.calls[0]).toEqual({
      method: 'GET',
      path: '/edu/roles',
      query: { schoolId: undefined },
    })
  })

  it('creates a role with its school and its permissions', async () => {
    const { transport, api } = build()

    await api.create({
      name: 'Teacher',
      description: 'Runs a group',
      schoolId: school,
      permissions: ['homework:grade'] as PermissionKey[],
    })

    expect(transport.calls[0]).toEqual({
      method: 'POST',
      path: '/edu/roles',
      body: {
        name: 'Teacher',
        description: 'Runs a group',
        schoolId: school,
        permissions: ['homework:grade'],
      },
    })
  })

  it('reads, updates and deletes one role by its identifier', async () => {
    const { transport, api } = build()

    await api.get(role)
    await api.update(role, { name: 'Renamed' })
    await api.remove(role)

    expect(transport.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /edu/roles/role-1',
      'PATCH /edu/roles/role-1',
      'DELETE /edu/roles/role-1',
    ])
  })
})
