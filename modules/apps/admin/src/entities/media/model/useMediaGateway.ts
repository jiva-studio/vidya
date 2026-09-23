import { inject, type InjectionKey } from 'vue'

import { FakeMediaGateway } from '../api/FakeMediaGateway'
import type { MediaGateway } from '../types'

/**
 * How a screen reaches storage. When not explicitly provided (e.g. in standalone
 * field tests), it falls back to a FakeMediaGateway.
 */
export const mediaGatewayKey: InjectionKey<MediaGateway> = Symbol('vidya.mediaGateway')

const defaultClock = {
  now: () => Date.now(),
  schedule: (fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms)
    return { cancel: () => clearTimeout(timer) }
  },
}

export const useMediaGateway = (): MediaGateway => {
  return inject(mediaGatewayKey, null) ?? new FakeMediaGateway({ clock: defaultClock })
}
