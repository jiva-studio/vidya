import type { UserId } from '@vidya/domain'
import type {
  GetOtpRequest,
  GetOtpResponse,
  GetProfileResponse,
  OtpSignInRequest,
  OtpSignInResponse,
  UpdateUserResponse,
} from '@vidya/protocol'
import { OtpType, Routes } from '@vidya/protocol'

import type { HttpClient, Session } from '@/ports'

const routes = Routes()

export const requestSignInCode = (http: HttpClient, email: string): Promise<GetOtpResponse> =>
  http.post<GetOtpResponse>(routes.otp.root(), {
    type: OtpType.Email,
    destination: email,
  } satisfies GetOtpRequest)

/** Trades the emailed code for a session. Storing it is the caller's business. */
export const signInWithCode = (
  http: HttpClient,
  credentials: { email: string; code: string },
): Promise<Session> =>
  http.post<OtpSignInResponse>(routes.auth.signIn('otp'), {
    login: credentials.email,
    otp: credentials.code,
  } satisfies OtpSignInRequest)

export const getProfile = (http: HttpClient): Promise<GetProfileResponse> =>
  http.get<GetProfileResponse>(routes.auth.profile())

/** What the student fills in after the first sign-in. */
export const updateProfile = (
  http: HttpClient,
  userId: UserId,
  profile: { name: string; phone?: string },
): Promise<UpdateUserResponse> =>
  http.patch<UpdateUserResponse>(routes.edu.user(userId).update(), profile)
