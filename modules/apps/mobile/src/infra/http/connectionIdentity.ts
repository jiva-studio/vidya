import type { UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { GetProfileResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { Session } from '@/ports'

import { httpClientFor } from './connectionHttpClient'

/**
 * Who the holder of these tokens is, according to that server.
 *
 * Part of signing in rather than a detail of it: a session carries tokens and
 * no user id, while `owner_id` keys every table on the device. The same person
 * on two servers is two different ids, so the answer can only come from the
 * server being signed in to.
 *
 * An adapter, because the whole of it is one request to one endpoint. The
 * transport it builds serves this one address and is not handed back: what the
 * caller receives is an identity, not a client that could reach elsewhere.
 */
export const ownerIdAt = async (baseUrl: string, session: Session): Promise<UserId> => {
  const http = httpClientFor({ baseUrl, session: () => session })
  const profile = await http.get<GetProfileResponse>(Routes().auth.profile())

  return asId<UserId>(profile.userId)
}
