import { describe, expect, it } from 'vitest'

import { createToasts } from '@/shared/lib'

import { announceFailure } from '../failures'

describe('announcing a failure to the operator', () => {
  it('says what happened, and quotes the server underneath', () => {
    const toasts = createToasts()

    announceFailure(toasts, { key: 'failure-conflict', reason: 'Name taken' })

    expect(toasts.items.value).toHaveLength(1)
    expect(toasts.items.value[0]).toMatchObject({ description: 'Name taken', tone: 'danger' })
  })

  // A screen that opens six lists loses all six to one cut cable. The operator
  // needs to be told that once.
  it('does not repeat itself while the same message is still on screen', () => {
    const toasts = createToasts()

    announceFailure(toasts, { key: 'failure-offline' })
    announceFailure(toasts, { key: 'failure-offline' })
    announceFailure(toasts, { key: 'failure-offline' })

    expect(toasts.items.value).toHaveLength(1)
  })

  it('says a different failure even while the first is still up', () => {
    const toasts = createToasts()

    announceFailure(toasts, { key: 'failure-offline' })
    announceFailure(toasts, { key: 'failure-forbidden' })

    expect(toasts.items.value).toHaveLength(2)
  })

  it('tells the same failure again once the operator has dismissed it', () => {
    const toasts = createToasts()

    announceFailure(toasts, { key: 'failure-offline' })
    toasts.dismiss(toasts.items.value[0].id)
    announceFailure(toasts, { key: 'failure-offline' })

    expect(toasts.items.value).toHaveLength(1)
  })
})
