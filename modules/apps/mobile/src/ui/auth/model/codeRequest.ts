import { HttpError } from '@vidya/client'

/** What the screen says, and does, when a request for a code comes back. */
export interface CodeRequestOutcome {
  /** The message shown, named by its translation. */
  readonly message: string

  readonly tone: 'danger' | 'medium'

  /** Whether a code is already waiting, so the screen moves on to entering it. */
  readonly codeIsWaiting: boolean
}

const TOO_MANY_REQUESTS = 429

/**
 * A refusal because the last code is still alive is not a failure.
 *
 * The code was sent and is sitting in the mailbox; only a *second* one is
 * being withheld. Telling that person to check their connection sends them to
 * repair something that is working, past the email that is already waiting —
 * so the two are told apart here, and only the other one is painted as an
 * error.
 *
 * How long the wait has left is not said: the server answers 429 with no hint
 * of it, and a countdown started here would be a guess about a code minted at
 * an unknown earlier moment.
 */
export function outcomeOfCodeRequest(error: unknown): CodeRequestOutcome {
  if (error instanceof HttpError && error.status === TOO_MANY_REQUESTS) {
    return { message: 'code-already-sent', tone: 'medium', codeIsWaiting: true }
  }

  return { message: 'could-not-send', tone: 'danger', codeIsWaiting: false }
}
