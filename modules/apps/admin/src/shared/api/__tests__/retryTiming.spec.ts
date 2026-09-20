import { describe, expect, it } from 'vitest'

import { backoffMs, MaxRetryAfterMs, retryAfterMs, RetryDelayMs } from '../retryTiming'

const NOW = Date.parse('2026-09-20T10:00:00.000Z')

describe('what the server asked the client to wait', () => {
  it('reads a count of seconds', () => {
    expect(retryAfterMs('2', NOW)).toBe(2000)
  })

  it('reads an HTTP date, as the same header is allowed to carry', () => {
    expect(retryAfterMs('Sun, 20 Sep 2026 10:00:05 GMT', NOW)).toBe(5000)
  })

  it('treats a date already past as no wait at all', () => {
    expect(retryAfterMs('Sun, 20 Sep 2026 09:59:00 GMT', NOW)).toBe(0)
  })

  it('caps a wait longer than a request should be held open for', () => {
    expect(retryAfterMs('600', NOW)).toBe(MaxRetryAfterMs)
  })

  it('ignores a header that parses as neither', () => {
    expect(retryAfterMs('soon', NOW)).toBeUndefined()
    expect(retryAfterMs('', NOW)).toBeUndefined()
    expect(retryAfterMs(null, NOW)).toBeUndefined()
  })
})

describe('the wait the client chooses for itself', () => {
  // `remaining` counts down: on the first retry the transport still holds both.
  it('doubles with every attempt already taken', () => {
    expect(backoffMs(2, 2)).toBe(RetryDelayMs)
    expect(backoffMs(1, 2)).toBe(RetryDelayMs * 2)
  })

  it('stays sane when the count it is handed makes no sense', () => {
    expect(backoffMs(9, 2)).toBe(RetryDelayMs)
    expect(backoffMs(-1, 2)).toBe(RetryDelayMs * 4)
  })
})
