import { config } from '@/config'
import { FetchHttpClient } from '@/infra'
import type { HttpClient } from '@/ports'

import { useSession } from './session'

let client: HttpClient | undefined

/**
 * The composition root for the transport.
 *
 * Built once, lazily, so the token is read at call time rather than captured:
 * signing in must not require rebuilding every caller.
 */
export const useApi = (): HttpClient => {
  if (!client) {
    const { session } = useSession()
    client = new FetchHttpClient({
      baseUrl: config.apiBaseUrl,
      accessToken: () => session.value?.accessToken,
    })
  }
  return client
}
