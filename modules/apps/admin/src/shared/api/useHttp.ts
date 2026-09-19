import { inject, type InjectionKey } from 'vue'

import type { HttpClient } from './types'
import { useApi } from './useApi'

/**
 * How a screen gets a transport, and the one place it can be swapped.
 *
 * Tests and Storybook provide a fake here, so a story is the screen itself
 * rather than a copy of it wired differently. Without a provider it falls back
 * to the real client, which is what the running application does.
 */
export const httpClientKey: InjectionKey<HttpClient> = Symbol('vidya.httpClient')

export const useHttp = (): HttpClient => inject(httpClientKey, null) ?? useApi()
