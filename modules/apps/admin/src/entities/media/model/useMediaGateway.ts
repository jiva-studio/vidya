import { inject, type InjectionKey } from 'vue'

import { FakeMediaGateway } from '../api/FakeMediaGateway'
import type { MediaGateway } from '../types'

/**
 * How a screen reaches storage. When not explicitly provided (e.g. in standalone
 * field tests), it falls back to a FakeMediaGateway.
 */
export const mediaGatewayKey: InjectionKey<MediaGateway> = Symbol('vidya.mediaGateway')

export const useMediaGateway = (): MediaGateway => {
  return inject(mediaGatewayKey, null) ?? new FakeMediaGateway()
}
