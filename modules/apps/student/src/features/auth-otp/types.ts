/** Which half of the sign-in the form is showing. */
export type OtpStep = 'email' | 'code'

export interface OtpFormEmits {
  /** The session is live; the caller decides where to go next. */
  (event: 'signed-in'): void
}
