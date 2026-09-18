import { vi } from 'vitest'

import type { HttpClient, HttpQuery } from '@/ports'

export interface RecordedCall {
  readonly method: string
  readonly path: string
  readonly query?: HttpQuery
  readonly body?: unknown
}

/**
 * A transport that answers from a table of paths and remembers what was asked.
 *
 * Keyed by path so a use case making several calls can be given a different
 * answer for each, which is what the two-step lesson read needs.
 */
export const fakeHttpClient = (answers: Record<string, unknown> = {}) => {
  const calls: RecordedCall[] = []
  const answerFor = (path: string) => {
    const key = Object.keys(answers)
      .sort((a, b) => b.length - a.length)
      .find((k) => path === k || path.startsWith(k))
    if (key === undefined) throw new Error(`fake transport has no answer for ${path}`)
    return answers[key]
  }

  const client: HttpClient = {
    get: vi.fn(async (path: string, query?: HttpQuery) => {
      calls.push({ method: 'GET', path, query })
      return answerFor(path)
    }) as HttpClient['get'],
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: 'POST', path, body })
      return answerFor(path)
    }) as HttpClient['post'],
    patch: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: 'PATCH', path, body })
      return answerFor(path)
    }) as HttpClient['patch'],
    delete: vi.fn(async (path: string) => {
      calls.push({ method: 'DELETE', path })
    }),
  }

  return { client, calls }
}
