import type { IEnrollmentRepository, SubmissionState } from '@vidya/client'
import type { IOutboxRepository, SyncCollection, SyncRejectionReason } from '@vidya/domain'
import type { Ref } from 'vue'

/** A sync run, as the tab that owns the engine offers it. */
export type SyncRun = () => void

/**
 * How far each journaled row has travelled, as a screen asks about it.
 *
 * A screen holds a document, not an outbox row, so the question is always
 * "what happened to this document" — and the answer has to be there when the
 * row is rendered rather than a promise. The journal is therefore read into a
 * snapshot and re-read when a run finishes.
 *
 * Two readings are held: the rows still waiting to be sent, and the refused
 * ones, which no later push will carry. A document with neither was taken by
 * the server, and only then is it accepted. Where both readings name one
 * document, the later row answers for it: a refusal is the last word only
 * until the student writes again.
 */
export interface OutboxView {
  state(collection: SyncCollection, docId: string): SubmissionState
  reason(collection: SyncCollection, docId: string): SyncRejectionReason | undefined

  /** Reads this identity's journal, and keeps reading it after every run. */
  track(ownerId: () => string, outbox: IOutboxRepository): void

  /** Reads it again now — after a local write, which no run has seen yet. */
  refresh(): void

  /** Gives the journal up: there is none to read until one is tracked again. */
  forget(): void
}

/**
 * What a screen is allowed to write to the device, when a tab may write at all.
 *
 * Only the tab holding the writing lock runs an engine, and only the engine's
 * repositories journal what they store. A reading tab is handed nothing rather
 * than an unjournaled repository, so the screens ask whether they can write
 * instead of writing somewhere the school will never hear of.
 */
export type EnrollmentWrites = Pick<
  IEnrollmentRepository,
  'request' | 'withdraw' | 'archive' | 'unarchive'
>

export interface DeviceWrites {
  /** Absent in a reading tab and while nobody is signed in. */
  readonly enrollments: Readonly<Ref<EnrollmentWrites | undefined>>

  /** Offered by the writing tab while its engine lives, withdrawn when it stops. */
  adoptEnrollments(writes: EnrollmentWrites | undefined): void
}
