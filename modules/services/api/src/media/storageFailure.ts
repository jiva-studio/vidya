import { MediaRefusal, MediaRefusals } from '@vidya/protocol'

/**
 * The ways a school's storage can refuse, kept apart because a school acts on
 * each one differently: we would not dial the address, the address turned the
 * keys away, nothing answered, the ciphertext we hold no longer opens, somebody
 * else rotated the keys first, or the ceiling stored for the school is not a
 * number we can answer with. Collapsing them into one message leaves the school
 * guessing which of them to change.
 */
export type StorageFailure =
  | 'endpoint-rejected'
  | 'credentials-rejected'
  | 'unreachable'
  | 'secret-unreadable'
  | 'rotation-conflicted'
  | 'quota-unreadable'
  | 'not-configured'

const MESSAGES: Readonly<Record<StorageFailure, MediaRefusal>> = Object.freeze({
  'endpoint-rejected': MediaRefusals.endpointRejected,
  'credentials-rejected': MediaRefusals.credentialsRejected,
  unreachable: MediaRefusals.storageUnreachable,
  'secret-unreadable': MediaRefusals.secretUnreadable,
  'rotation-conflicted': MediaRefusals.rotationConflicted,
  'quota-unreadable': MediaRefusals.quotaUnreadable,
  'not-configured': MediaRefusals.notConfigured,
})

/**
 * Thrown by the domain, translated to a status by `StorageFailureFilter`.
 *
 * The message is a key and nothing else: the cause is deliberately not carried
 * across, because the only detail a storage refusal has to offer is the secret
 * that was refused, and that must never reach a response body or a log line.
 */
export class StorageFailedError extends Error {
  constructor(readonly failure: StorageFailure) {
    super(MESSAGES[failure])
  }

  get refusal(): MediaRefusal {
    return MESSAGES[this.failure]
  }
}
