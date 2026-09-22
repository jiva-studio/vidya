import type { JoinNotice, JoinStage } from '../types'

/**
 * What the page says when joining cannot go on, in the student's terms.
 *
 * A status code is not an explanation. "The school is not taking students
 * yet" and "this link leads nowhere" are different situations with different
 * things to do next, and only one of the three is worth trying again.
 */
const NOTICES: Partial<Record<JoinStage, JoinNotice>> = {
  unknown: { title: 'join-unknown-title', text: 'join-unknown-text', retry: false },
  closed: { title: 'join-closed-title', text: 'join-closed-text', retry: false },
  failed: { title: 'join-failed-title', text: 'join-failed-text', retry: true },
}

export const noticeFor = (stage: JoinStage): JoinNotice | undefined => NOTICES[stage]
