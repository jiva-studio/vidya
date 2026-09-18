// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { HttpError, OfflineError } from '@/ports'

import { useRemoteData } from '../useRemoteData'

vi.mock('@ionic/vue', () => ({ onIonViewWillEnter: () => undefined }))

/**
 * The composable needs a component to mount in, but nothing on screen, so the
 * harness runs setup and hands back what it returned.
 */
const run = async <TResult>(setup: () => TResult): Promise<TResult> => {
  const { createApp } = await import('vue')
  let result!: TResult
  const app = createApp(
    defineComponent({
      setup() {
        result = setup()
        return () => h('div')
      },
    }),
  )
  app.mount(document.createElement('div'))
  await nextTick()
  return result
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useRemoteData', () => {
  it('holds the answer once it arrives', async () => {
    const state = await run(() =>
      useRemoteData(async () => 'courses', undefined as string | undefined),
    )
    await nextTick()

    expect(state.data.value).toBe('courses')
    expect(state.loaded.value).toBe(true)
    expect(state.failure.value).toBeUndefined()
  })

  it('ignores a slow load that is overtaken by a newer one', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const loads = [first.promise, second.promise]
    let call = 0

    const state = await run(() =>
      useRemoteData(
        () => loads[call++] ?? Promise.resolve('extra'),
        undefined as string | undefined,
      ),
    )

    void state.reload()
    second.resolve('new')
    await nextTick()
    await nextTick()

    first.resolve('stale')
    await nextTick()
    await nextTick()

    expect(state.data.value).toBe('new')
  })

  it('ignores a failure from a load that is no longer the current one', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const loads = [first.promise, second.promise]
    let call = 0

    const state = await run(() =>
      useRemoteData(
        () => loads[call++] ?? Promise.resolve('extra'),
        undefined as string | undefined,
      ),
    )

    void state.reload()
    second.resolve('new')
    await nextTick()
    await nextTick()

    first.reject(new OfflineError('/edu/courses'))
    await nextTick()
    await nextTick()

    expect(state.failure.value).toBeUndefined()
    expect(state.data.value).toBe('new')
  })

  it.each([
    ['offline', new OfflineError('/x'), 'offline'],
    ['a rejected token', new HttpError(401, '/x'), 'unauthorized'],
    ['anything else', new HttpError(500, '/x'), 'failed'],
  ])('tells %s apart', async (_case, error, expected) => {
    const state = await run(() =>
      useRemoteData(async () => {
        throw error
      }, undefined),
    )
    await nextTick()

    expect(state.failure.value).toBe(expected)
  })
})
