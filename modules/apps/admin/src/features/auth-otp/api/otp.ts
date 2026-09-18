import type {
  GetOtpRequest,
  GetOtpResponse,
  OtpSignInRequest,
  OtpSignInResponse,
} from '@vidya/protocol'
import { OtpType, Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

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
