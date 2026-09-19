import { endSessionOn401, useConnections, useSession } from '@/app'
import { config } from '@/config'
import { httpClientFor } from '@/infra'
import { normaliseBaseUrl } from '@/ports'

/**
 * The transport sign-in speaks through, bound to the server being signed in to.
 *
 * There is no shared client to reach for: a client closes over one address, so
 * the token a server issues has nowhere to travel but back to that server.
 * Sign-in is one of the two places allowed to build one at all — until it
 * finishes there is no connection, no identity and nothing on the device.
 *
 * The session is read per request rather than captured, because the first calls
 * of the wizard are made without one and the ones after it are made with the
 * session the wizard has just stored.
 *
 * A refusal marks this connection as needing a new sign-in and stops there:
 * ending every session would sign the student out of schools that are still
 * perfectly reachable.
 */
export function useAuthClient() {
  const baseUrl = normaliseBaseUrl(config.apiBaseUrl)
  const { session } = useSession()
  const connections = useConnections()

  const client = httpClientFor({ baseUrl, session: () => session.value })

  return { baseUrl, client: endSessionOn401(client, () => connections.markNeedsSignIn(baseUrl)) }
}
