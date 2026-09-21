import { MediaRefusal, MediaRefusals } from '@vidya/protocol'

/**
 * The ways an upload is turned down, kept apart because the uploader does
 * something different about each: free some room, pick a smaller file, pick
 * another format, or wait for the bytes to actually land.
 */
export type MediaRefusalKind = 'quota-exceeded' | 'too-large' | 'type-not-allowed' | 'not-ready'

const MESSAGES: Readonly<Record<MediaRefusalKind, MediaRefusal>> = Object.freeze({
  'quota-exceeded': MediaRefusals.quotaExceeded,
  'too-large': MediaRefusals.tooLarge,
  'type-not-allowed': MediaRefusals.typeNotAllowed,
  'not-ready': MediaRefusals.notReady,
})

/**
 * Thrown by the domain, translated to a status by `MediaRefusalFilter`.
 *
 * The message is a key rather than a sentence: the admin renders it from its
 * own locale bundle, so a sentence composed here would arrive in the wrong
 * language and say something the bundle cannot override.
 */
export class MediaRefusedError extends Error {
  constructor(readonly kind: MediaRefusalKind) {
    super(MESSAGES[kind])
  }

  get refusal(): MediaRefusal {
    return MESSAGES[this.kind]
  }
}
