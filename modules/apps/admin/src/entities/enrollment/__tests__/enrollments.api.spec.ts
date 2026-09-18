import type { EnrollmentId, GroupId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '@/shared/testing'

import { enrollmentApi } from '../api'

const ENROLLMENTS = '/edu/enrollments'

const withApi = () => {
  const transport = fakeHttpClient({ [ENROLLMENTS]: { items: [] } })
  return { transport, api: enrollmentApi(transport.client) }
}

describe('enrollmentApi', () => {
  it('sends the filters as the query, and no school', async () => {
    const { transport, api } = withApi()

    await api.list({ status: 'pending' })

    expect(transport.calls[0]).toEqual({
      method: 'GET',
      path: ENROLLMENTS,
      query: { status: 'pending' },
    })
  })

  it('moderates with a patch to the moderation route', async () => {
    const { transport, api } = withApi()

    await api.moderate('e1' as EnrollmentId, { status: 'accepted' })

    expect(transport.calls[0]).toEqual({
      method: 'PATCH',
      path: `${ENROLLMENTS}/e1/moderation`,
      body: { status: 'accepted' },
    })
  })

  it('assigns a group through the group route, and clears it with null', async () => {
    const { transport, api } = withApi()

    await api.assignGroup('e1' as EnrollmentId, 'g1' as GroupId)
    await api.assignGroup('e1' as EnrollmentId, null)

    expect(transport.calls[0].body).toEqual({ groupId: 'g1' })
    expect(transport.calls[1].body).toEqual({ groupId: null })
  })
})
