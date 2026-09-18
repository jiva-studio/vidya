import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest'

import { HttpError } from '../errors'
import { refreshOn401 } from '../refreshOn401'
import type { HttpClient } from '../types'

/** A transport whose answer to each successive call is scripted by the test. */
const scripted = (answers: Array<'ok' | number>) => {
  let index = 0
  const next = async () => {
    const answer = answers[Math.min(index, answers.length - 1)]
    index += 1
    if (answer === 'ok') return { ok: true }
    throw new HttpError(answer, '/edu/courses')
  }

  const client: HttpClient = {
    get: vi.fn(next) as HttpClient['get'],
    post: vi.fn(next) as HttpClient['post'],
    patch: vi.fn(next) as HttpClient['patch'],
    delete: vi.fn(next) as unknown as HttpClient['delete'],
  }

  return { client, calls: () => index }
}

describe('refreshOn401', () => {
  let refresh: MockedFunction<() => Promise<boolean>>
  let endSession: MockedFunction<() => Promise<void>>

  beforeEach(() => {
    refresh = vi.fn(async () => true)
    endSession = vi.fn(async () => {})
  })

  it('refreshes once and retries the request once', async () => {
    const { client, calls } = scripted([401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await expect(guarded.get('/edu/courses')).resolves.toEqual({ ok: true })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls()).toBe(2)
    expect(endSession).not.toHaveBeenCalled()
  })

  it('shares one refresh between three requests that fail at the same time', async () => {
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    refresh = vi.fn(async () => {
      await held
      return true
    })

    const { client } = scripted([401, 401, 401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    const inFlight = [guarded.get('/a'), guarded.get('/b'), guarded.get('/c')]
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    release()

    await expect(Promise.all(inFlight)).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('retries each of the three requests exactly once', async () => {
    const answers = new Map<string, number>()
    const client: HttpClient = {
      get: vi.fn(async (path: string) => {
        const seen = (answers.get(path) ?? 0) + 1
        answers.set(path, seen)
        if (seen === 1) throw new HttpError(401, path)
        return { ok: true }
      }) as HttpClient['get'],
      post: vi.fn() as unknown as HttpClient['post'],
      patch: vi.fn() as unknown as HttpClient['patch'],
      delete: vi.fn() as unknown as HttpClient['delete'],
    }

    const guarded = refreshOn401(client, { refresh, endSession })
    await Promise.all([guarded.get('/a'), guarded.get('/b'), guarded.get('/c')])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect([...answers.values()]).toEqual([2, 2, 2])
  })

  it('ends the session when the refresh fails, and does not retry', async () => {
    refresh = vi.fn(async () => false)
    const { client, calls } = scripted([401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await expect(guarded.get('/edu/courses')).rejects.toBeInstanceOf(HttpError)

    expect(endSession).toHaveBeenCalledTimes(1)
    expect(calls()).toBe(1)
  })

  it('ends the session when the refresh itself throws', async () => {
    refresh = vi.fn(async () => {
      throw new Error('network down')
    })
    const { client } = scripted([401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await expect(guarded.get('/edu/courses')).rejects.toBeInstanceOf(HttpError)
    expect(endSession).toHaveBeenCalledTimes(1)
  })

  it('ends the session on a 401 that survives a successful refresh', async () => {
    const { client, calls } = scripted([401, 401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await expect(guarded.get('/edu/courses')).rejects.toBeInstanceOf(HttpError)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls()).toBe(2)
    expect(endSession).toHaveBeenCalledTimes(1)
  })

  it.each([403, 404, 409, 429, 500])('leaves %i alone', async (status) => {
    const { client, calls } = scripted([status, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await expect(guarded.get('/edu/courses')).rejects.toMatchObject({ status })

    expect(refresh).not.toHaveBeenCalled()
    expect(endSession).not.toHaveBeenCalled()
    expect(calls()).toBe(1)
  })

  it('refreshes again for a later 401, once the first refresh is done', async () => {
    const { client } = scripted([401, 'ok', 401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await guarded.get('/first')
    await guarded.get('/second')

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('guards every verb', async () => {
    const { client } = scripted([401, 'ok'])
    const guarded = refreshOn401(client, { refresh, endSession })

    await expect(guarded.post('/a', {})).resolves.toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
