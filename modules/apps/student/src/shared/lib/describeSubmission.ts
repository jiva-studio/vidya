import type { SubmissionState } from '@vidya/client'
import type { BadgeTone } from '@vidya/ui'

/**
 * How far a record got, as a screen says it: two message keys and a colour.
 *
 * The hint is not decoration. "Not sent" alone reads as work that was lost,
 * and the sentence beside it is what says the work is on this machine and
 * leaves as soon as there is a connection.
 */
export interface SubmissionBadge {
  readonly key: string
  readonly hintKey: string
  readonly tone: BadgeTone
}

const BADGES: Record<SubmissionState, SubmissionBadge> = {
  notSent: { key: 'sync-state-notSent', hintKey: 'sync-state-notSent-hint', tone: 'neutral' },
  sending: { key: 'sync-state-sending', hintKey: 'sync-state-sending-hint', tone: 'info' },
  accepted: { key: 'sync-state-accepted', hintKey: 'sync-state-accepted-hint', tone: 'success' },
  rejected: { key: 'sync-state-rejected', hintKey: 'sync-state-rejected-hint', tone: 'danger' },
}

export const describeSubmission = (state: SubmissionState): SubmissionBadge => BADGES[state]
