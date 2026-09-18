import { HttpError } from '../api'
import type { HttpClient, HttpQuery } from '../api'
import type { FakeAnswer, FakeAnswers, RecordedCall } from './types'

const matches = (path: string, key: string): boolean => {
  const [method, pattern] = key.includes(' ') ? key.split(' ') : ['', key]
  void method
  return path === pattern || path.startsWith(pattern)
}

/**
 * A transport that answers from a table and remembers what was asked.
 *
 * Shared by every track so that a mounted test and the Storybook story of the
 * same screen are driven by one thing: a screen that works in the story and
 * fails in the test would otherwise mean the two fakes disagree.
 *
 * Keys are matched longest first, so `/edu/courses/1` can answer differently
 * from `/edu/courses`. A key may be prefixed with a verb — `POST /edu/courses`
 * — when a path has to answer one way to a read and another to a write.
 */
export const fakeHttpClient = (answers: FakeAnswers = {}) => {
  const calls: RecordedCall[] = []

  const keysFor = (call: RecordedCall) =>
    Object.keys(answers)
      .filter((key) => !key.includes(' ') || key.startsWith(`${call.method} `))
      .sort((a, b) => b.length - a.length)

  const resolve = (call: RecordedCall): unknown => {
    const key = keysFor(call).find((candidate) => matches(call.path, candidate))
    if (key === undefined) {
      throw new Error(`fake transport has no answer for ${call.method} ${call.path}`)
    }

    const answer: FakeAnswer = answers[key]
    if (answer instanceof Error) throw answer
    if (typeof answer === 'function') return (answer as (c: RecordedCall) => unknown)(call)
    return answer
  }

  const record = async (call: RecordedCall) => {
    calls.push(call)
    return resolve(call)
  }

  const client: HttpClient = {
    get: (<TResponse>(path: string, query?: HttpQuery) =>
      record({ method: 'GET', path, query }) as Promise<TResponse>) as HttpClient['get'],
    post: (<TResponse>(path: string, body?: unknown) =>
      record({ method: 'POST', path, body }) as Promise<TResponse>) as HttpClient['post'],
    patch: (<TResponse>(path: string, body?: unknown) =>
      record({ method: 'PATCH', path, body }) as Promise<TResponse>) as HttpClient['patch'],
    delete: async (path: string) => {
      await record({ method: 'DELETE', path })
    },
  }

  const callsTo = (path: string) => calls.filter((call) => call.path === path)

  return { client, calls, callsTo }
}

/** A refusal with a body, for the tests and stories that show the server's reason. */
export const refusal = (status: number, message: string, path = ''): HttpError =>
  new HttpError(status, path, { message })

/** A promise that never settles: the loading state of any screen. */
export const pending = (): Promise<never> => new Promise(() => {})
