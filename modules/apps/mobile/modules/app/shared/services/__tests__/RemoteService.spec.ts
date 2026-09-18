import { afterEach, describe, expect, it, vi } from 'vitest'

import { RemoteService } from '../RemoteService'

class TestService extends RemoteService {
  constructor() {
    super('https://api.example.test', 'token')
  }

  callGet = () => this.get('/courses')
  callPost = () => this.post('/courses', { title: 'Gita' })
  callPatch = () => this.patch('/courses/1', { title: 'Gita' })
  callDelete = () => this.delete('/courses/1')
}

const okResponse = () => ({ ok: true, json: async () => ({}) }) as Response

describe('RemoteService', () => {
  afterEach(() => vi.unstubAllGlobals())

  const requestedUrl = async (call: () => Promise<unknown>): Promise<string> => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    await call()
    return fetchMock.mock.calls[0][0] as string
  }

  const service = new TestService()

  it.each([
    ['get', () => service.callGet(), 'https://api.example.test/courses'],
    ['post', () => service.callPost(), 'https://api.example.test/courses'],
    ['patch', () => service.callPatch(), 'https://api.example.test/courses/1'],
    ['delete', () => service.callDelete(), 'https://api.example.test/courses/1'],
  ])('sends a %s to the requested path', async (_method, call, expected) => {
    expect(await requestedUrl(call)).toBe(expected)
  })
})
