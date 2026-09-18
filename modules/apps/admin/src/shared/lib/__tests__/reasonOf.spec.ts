import { describe, expect, it } from 'vitest'

import { HttpError, OfflineError } from '@/shared/api'

import { reasonOf } from '../reasonOf'

describe('reasonOf', () => {
  it('says the connection is gone rather than blaming the server', () => {
    expect(reasonOf(new OfflineError('/edu/courses'), 'courses-load-failed')).toBe('error-offline')
  })

  it('prefers a house sentence to the server one on a refusal', () => {
    const forbidden = new HttpError(403, '/edu/courses', { message: 'Forbidden resource' })

    expect(reasonOf(forbidden, 'courses-load-failed')).toBe('error-forbidden')
  })

  it('shows the sentence the server gave, because it says what to do', () => {
    const conflict = new HttpError(409, '/edu/schools', {
      message: 'A school with this name exists',
    })

    expect(reasonOf(conflict, 'schools-load-failed')).toBe('A school with this name exists')
  })

  it('joins a failed validation into one line', () => {
    const invalid = new HttpError(400, '/edu/courses', {
      message: ['name is required', 'too long'],
    })

    expect(reasonOf(invalid, 'courses-save-failed')).toBe('name is required, too long')
  })

  it('falls back to the caller key when the server gave no words', () => {
    expect(reasonOf(new HttpError(500, '/edu/courses'), 'courses-load-failed')).toBe(
      'courses-load-failed',
    )
    expect(reasonOf(new Error('boom'), 'courses-load-failed')).toBe('courses-load-failed')
  })

  it('falls back to the shared key when the caller named none', () => {
    expect(reasonOf(new Error('boom'))).toBe('state-error')
  })
})
