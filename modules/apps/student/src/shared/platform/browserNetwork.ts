import type { INetworkStatus } from './types'

/**
 * `navigator.onLine` and the `online` event.
 *
 * `navigator.onLine` is a lower bound: `false` means there is certainly no
 * network, `true` only means the machine has an interface up. That is enough
 * for what it is asked here — whether to attempt a run at all — and it is why
 * a failed run is a retry rather than a claim about the network.
 */
export const browserNetwork = (): INetworkStatus => ({
  isOnline: () => navigator.onLine,

  onOnline: (handler) => {
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  },
})
