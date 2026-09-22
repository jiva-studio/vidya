import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserNetwork } from '../browserNetwork'

const pretend = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

describe('what the browser says about the network', () => {
  afterEach(() => {
    pretend(true)
  })

  it('reports what the browser reports', () => {
    pretend(false)
    expect(browserNetwork().isOnline()).toBe(false)

    pretend(true)
    expect(browserNetwork().isOnline()).toBe(true)
  })

  it('calls back when the connection returns', () => {
    const back = vi.fn()
    const stop = browserNetwork().onOnline(back)

    window.dispatchEvent(new Event('online'))
    expect(back).toHaveBeenCalledTimes(1)

    stop()
    window.dispatchEvent(new Event('online'))
    expect(back).toHaveBeenCalledTimes(1)
  })
})
