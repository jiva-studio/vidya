import { MediaRefusal, MediaRefusals } from '@vidya/protocol'

/**
 * The ways a file is turned down, kept apart because the caller does something
 * different about each: free some room, pick a smaller file, pick another
 * format, wait for the bytes to actually land, take the file out of the lessons
 * that show it, or stop naming a file this school does not have.
 */
export type MediaRefusalKind =
  'quota-exceeded' | 'too-large' | 'type-not-allowed' | 'not-ready' | 'in-use' | 'unknown-media'

const MESSAGES: Readonly<Record<MediaRefusalKind, MediaRefusal>> = Object.freeze({
  'quota-exceeded': MediaRefusals.quotaExceeded,
  'too-large': MediaRefusals.tooLarge,
  'type-not-allowed': MediaRefusals.typeNotAllowed,
  'not-ready': MediaRefusals.notReady,
  'in-use': MediaRefusals.inUse,
  'unknown-media': MediaRefusals.unknownMedia,
})

/**
 * Thrown by the domain, translated to a status by `MediaRefusalFilter`.
 *
 * The message is a key rather than a sentence: the admin renders it from its
 * own locale bundle, so a sentence composed here would arrive in the wrong
 * language and say something the bundle cannot override.
 */
export class MediaRefusedError extends Error {
  /**
   * `details` are merged into the answered body, for a refusal that is not
   * actionable without them: "in use" has to name where.
   */
  constructor(
    readonly kind: MediaRefusalKind,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(MESSAGES[kind])
  }

  get refusal(): MediaRefusal {
    return MESSAGES[this.kind]
  }
}
