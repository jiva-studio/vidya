import type { HttpClient } from '@vidya/client'
import { inject, type InjectionKey } from 'vue'

/**
 * How a screen gets the one transport, and the one place it can be swapped.
 *
 * The client itself is built in the composition root, which is also the only
 * place allowed to build one. Tests and stories provide their own here, so a
 * story is the screen itself rather than a copy of it wired differently.
 */
export const httpClientKey: InjectionKey<HttpClient> = Symbol('vidya.httpClient')

export const useHttp = (): HttpClient => {
  const client = inject(httpClientKey, null)
  if (client === null) throw new Error('no transport was provided to this application')

  return client
}
