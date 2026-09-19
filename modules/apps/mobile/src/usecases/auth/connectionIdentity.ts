import type { UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import { httpClientFor } from '@/infra'
import type { Session } from '@/ports'

import { getProfile } from './session'

/**
 * Who the holder of these tokens is, according to that server.
 *
 * Part of signing in rather than a detail of it: a session carries tokens and
 * no user id, while `owner_id` keys every table on the device. The same person
 * on two servers is two different ids, so the answer can only come from the
 * server being signed in to.
 *
 * The transport is built here, for this one address, and is not handed out:
 * the registry above holds connections, not clients, and a token that never
 * meets another server cannot be sent to one.
 */
export const identityAt = async (baseUrl: string, session: Session): Promise<UserId> => {
  const profile = await getProfile(httpClientFor({ baseUrl, session: () => session }))
  return asId<UserId>(profile.userId)
}
