import { describe, expect, it } from 'vitest'

import { HttpError, OfflineError } from '../errors'
import { announceFailures, describe as describeFailure } from '../failures'
import type { Failure, HttpClient } from '../types'

const failing = (error: unknown): HttpClient => ({
  get: () => Promise.reject(error),
  post: () => Promise.reject(error),
  patch: () => Promise.reject(error),
  delete: () => Promise.reject(error),
})

const watched = (error: unknown) => {
  const said: Failure[] = []
  const client = announceFailures(failing(error), (failure) => said.push(failure))
  return { client, said }
}

describe('what an operator is told', () => {
  it('names the refusal and carries the words the server used', () => {
    const failure = describeFailure(new HttpError(409, '/edu/courses', { message: 'Name taken' }))

    expect(failure).toEqual({ key: 'failure-conflict', reason: 'Name taken' })
  })

  it('says the server could not be reached when the request never left', () => {
    expect(describeFailure(new OfflineError('/edu/courses'))).toEqual({ key: 'failure-offline' })
  })

  it('falls back to one line for a status nothing was written for', () => {
    expect(describeFailure(new HttpError(500, '/edu/courses'))).toEqual({
      key: 'failure-server',
      reason: undefined,
    })
  })
})

describe('announcing a failure', () => {
  it('reports a refused write and still lets the caller see it', async () => {
    const { client, said } = watched(new HttpError(500, '/edu/courses'))

    await expect(client.post('/edu/courses', {})).rejects.toBeInstanceOf(HttpError)
    expect(said).toEqual([{ key: 'failure-server', reason: undefined }])
  })

  // The session is being renewed under the caller, and an expiry that fixed
  // itself is not news.
  it('says nothing about an expired token', async () => {
    const { client, said } = watched(new HttpError(401, '/edu/courses'))

    await expect(client.get('/edu/courses')).rejects.toBeInstanceOf(HttpError)
    expect(said).toEqual([])
  })

  // A name read for a row is read on the off-chance: the reader may simply not
  // hold `users:read`, and a queue of thirty works must not raise thirty
  // complaints about something the screen already copes with.
  it('says nothing about a read the caller asked quietly', async () => {
    const { client, said } = watched(new HttpError(403, '/edu/users/u1'))

    await expect(client.get('/edu/users/u1', undefined, { quiet: true })).rejects.toBeInstanceOf(
      HttpError,
    )
    expect(said).toEqual([])
  })
})
