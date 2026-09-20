import { inject, type InjectionKey } from 'vue'

import type { MediaGateway } from '../types'

/**
 * How a screen reaches storage. Unlike the HTTP client there is no fallback:
 * nothing serves media yet, so an unprovided gateway is a wiring mistake.
 */
export const mediaGatewayKey: InjectionKey<MediaGateway> = Symbol('vidya.mediaGateway')

export const useMediaGateway = (): MediaGateway => {
  const gateway = inject(mediaGatewayKey, null)
  if (!gateway) throw new Error('no media gateway provided')

  return gateway
}
