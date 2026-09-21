import type { HttpClient } from '@vidya/client'
import type { UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type {
  GetOtpRequest,
  GetOtpResponse,
  GetProfileResponse,
  OtpSignInRequest,
  OtpSignInResponse,
} from '@vidya/protocol'
import { OtpType, Routes } from '@vidya/protocol'

/**
 * The three requests the site makes outside synchronisation.
 *
 * They exist before there is anything to synchronise with: no session, and on
 * a new machine no local database either. Every one of them is handed the
 * transport rather than making one, which is what keeps the rest of the site
 * off the network — see `app/__tests__/networkBoundary.spec.ts`.
 */
export const requestCode = (http: HttpClient, email: string): Promise<GetOtpResponse> =>
  http.post<GetOtpResponse>(Routes().otp.root(), {
    type: OtpType.Email,
    destination: email,
  } satisfies GetOtpRequest)

export const signInWithCode = (
  http: HttpClient,
  email: string,
  code: string,
): Promise<OtpSignInResponse> =>
  http.post<OtpSignInResponse>(Routes().auth.signIn('otp'), {
    login: email,
    otp: code,
  } satisfies OtpSignInRequest)

/**
 * Who the tokens belong to, according to the server.
 *
 * Part of signing in rather than a detail of it: a session carries tokens and
 * no user id, while every row of the local database is keyed by one.
 */
export const readOwnerId = async (http: HttpClient): Promise<UserId> => {
  const profile = await http.get<GetProfileResponse>(Routes().auth.profile())
  return asId<UserId>(profile.userId)
}
