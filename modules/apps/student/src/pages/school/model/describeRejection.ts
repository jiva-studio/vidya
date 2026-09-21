import type { SyncRejectionReason } from '@vidya/domain'

/**
 * The refusal in the student's terms, as a message key.
 *
 * A code is not an explanation, and one message for all of them would tell a
 * student the school turned them down when the school never saw the request:
 * access taken away, a course not being taught yet and a body the school could
 * not read are three different situations with three different things to do.
 */
const NOTICES: Readonly<Record<SyncRejectionReason, string>> = Object.freeze({
  readOnlyCollection: 'place-rejected-readOnlyCollection',
  notYourEnrollment: 'place-rejected-notYourEnrollment',
  enrollmentRevoked: 'place-rejected-enrollmentRevoked',
  unknownLessonVersion: 'place-rejected-unknownLessonVersion',
  alreadyAccepted: 'place-rejected-alreadyAccepted',
  payloadTooLarge: 'place-rejected-payloadTooLarge',
  underReview: 'place-rejected-underReview',
  courseNotOffered: 'place-rejected-courseNotOffered',
  malformed: 'place-rejected-malformed',
  scopeRevoked: 'place-rejected-scopeRevoked',
})

export const describeRejection = (reason: SyncRejectionReason): string => NOTICES[reason]
