import { describe, expect, it, vi } from 'vitest'

import { type HttpClient, HttpError, OfflineError } from '@/ports'

import { endSessionOn401 } from '../endSessionOn401'

const clientThatThrows = (error: unknown): HttpClient => ({
  get: vi.fn().mockRejectedValue(error),
  post: vi.fn().mockRejectedValue(error),
  patch: vi.fn().mockRejectedValue(error),
  delete: vi.fn().mockRejectedValue(error),
})

describe('endSessionOn401', () => {
  it.each([
    ['get', (c: HttpClient) => c.get('/edu/courses')],
    ['post', (c: HttpClient) => c.post('/edu/enrollments', {})],
    ['patch', (c: HttpClient) => c.patch('/edu/users/1', {})],
    ['delete', (c: HttpClient) => c.delete('/edu/enrollments/1')],
  ])('ends the session when %s is refused with 401', async (_method, call) => {
    const endSession = vi.fn().mockResolvedValue(undefined)
    const client = endSessionOn401(clientThatThrows(new HttpError(401, '/x')), endSession)

    await expect(call(client)).rejects.toBeInstanceOf(HttpError)
    expect(endSession).toHaveBeenCalledOnce()
  })

  it.each([
    ['a 403', new HttpError(403, '/x')],
    ['a 500', new HttpError(500, '/x')],
    ['a request that never left the device', new OfflineError('/x')],
  ])('keeps the session on %s', async (_case, error) => {
    const endSession = vi.fn().mockResolvedValue(undefined)
    const client = endSessionOn401(clientThatThrows(error), endSession)

    await expect(client.get('/edu/courses')).rejects.toBe(error)
    expect(endSession).not.toHaveBeenCalled()
  })

  it('passes a successful answer through untouched', async () => {
    const inner: HttpClient = {
      get: vi.fn().mockResolvedValue({ items: [] }),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }
    const endSession = vi.fn()

    await expect(endSessionOn401(inner, endSession).get('/edu/courses')).resolves.toEqual({
      items: [],
    })
    expect(endSession).not.toHaveBeenCalled()
  })
})
