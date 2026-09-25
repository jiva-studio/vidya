import { inject, type InjectionKey } from 'vue'

import { FakeMediaGateway } from '../api/FakeMediaGateway'
import type { MediaGateway } from '../types'

/**
 * How a screen reaches storage. When not explicitly provided (e.g. in standalone
 * field tests), it falls back to a FakeMediaGateway.
 */
export const mediaGatewayKey: InjectionKey<MediaGateway> = Symbol('vidya.mediaGateway')

let defaultGateway: MediaGateway | undefined

export const useMediaGateway = (): MediaGateway => {
  const injected = inject(mediaGatewayKey, null)
  if (injected) return injected
  if (!defaultGateway) defaultGateway = new FakeMediaGateway()
  return defaultGateway
}
