import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpError, OfflineError } from '@/ports'

import { FetchHttpClient } from '../fetchHttpClient'

const client = new FetchHttpClient({
  baseUrl: 'https://api.example.test',
  accessToken: () => 'token',
})

const respondWith = (response: Partial<Response>) => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('FetchHttpClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  describe('the URL it calls', () => {
    it.each([
      ['get', () => client.get('/edu/courses'), 'https://api.example.test/edu/courses'],
      ['post', () => client.post('/edu/courses', {}), 'https://api.example.test/edu/courses'],
      ['patch', () => client.patch('/edu/courses/1', {}), 'https://api.example.test/edu/courses/1'],
      ['delete', () => client.delete('/edu/courses/1'), 'https://api.example.test/edu/courses/1'],
    ])('puts the path after the base url on %s', async (_method, call, expected) => {
      const fetchMock = respondWith({})
      await call()
      expect(fetchMock.mock.calls[0][0]).toBe(expected)
    })

    it('appends a query string and drops the keys that carry no value', async () => {
      const fetchMock = respondWith({})
      await client.get('/edu/enrollments', { studentId: 'u-1', groupId: undefined })
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.example.test/edu/enrollments?studentId=u-1',
      )
    })

    it('leaves the path alone when every query value is absent', async () => {
      const fetchMock = respondWith({})
      await client.get('/edu/enrollments', { studentId: undefined })
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/edu/enrollments')
    })
  })

  describe('what it does with the answer', () => {
    it('reports the status the server refused with', async () => {
      respondWith({ ok: false, status: 401 })
      await expect(client.get('/auth/profile')).rejects.toBeInstanceOf(HttpError)
    })

    it('tells a request that never left the device apart from a refusal', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
      await expect(client.get('/edu/courses')).rejects.toBeInstanceOf(OfflineError)
    })

    it('does not try to parse a body out of 204', async () => {
      respondWith({
        status: 204,
        json: async () => {
          throw new Error('no body')
        },
      })
      await expect(client.delete('/edu/courses/1')).resolves.toBeUndefined()
    })
  })
})
