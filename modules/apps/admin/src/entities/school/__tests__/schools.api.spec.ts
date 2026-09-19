import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '@/shared/testing'

import { schoolApi } from '../api'

const id = asId<SchoolId>('school-1')

const build = () => {
  const transport = fakeHttpClient({
    '/edu/schools': { items: [] },
    'POST /edu/schools': { id },
    'PATCH /edu/schools': { id, name: 'Renamed' },
  })
  return { transport, api: schoolApi(transport.client) }
}

describe('schoolApi', () => {
  it('asks for the schools the token allows, without a filter of its own', async () => {
    const { transport, api } = build()

    await api.list()

    expect(transport.calls).toEqual([{ method: 'GET', path: '/edu/schools', query: undefined }])
  })

  it('reads one school by its identifier', async () => {
    const { transport, api } = build()

    await api.get(id)

    expect(transport.calls[0]).toMatchObject({ method: 'GET', path: '/edu/schools/school-1' })
  })

  it('creates a school, leaving the fields the form does not collect empty', async () => {
    const { transport, api } = build()

    await api.create({ name: 'Second', logoUrl: null, description: null })

    expect(transport.calls[0]).toEqual({
      method: 'POST',
      path: '/edu/schools',
      body: { name: 'Second', logoUrl: null, description: null },
    })
  })

  it('renames a school with a patch', async () => {
    const { transport, api } = build()

    await api.update(id, { name: 'Renamed' })

    expect(transport.calls[0]).toEqual({
      method: 'PATCH',
      path: '/edu/schools/school-1',
      body: { name: 'Renamed' },
    })
  })

  it('reads and writes the settings on their own resource', async () => {
    const transport = fakeHttpClient({
      '/edu/schools/school-1/configs': { studentRoleIds: [] },
    })
    const api = schoolApi(transport.client)

    await api.configs(id)
    await api.saveConfigs(id, { studentRoleIds: [] })

    expect(transport.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /edu/schools/school-1/configs',
      'PATCH /edu/schools/school-1/configs',
    ])
  })
})
