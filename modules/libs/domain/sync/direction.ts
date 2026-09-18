/**
 * Which way each collection replicates, and who owns which field.
 *
 * This is the "Synchronisation: what goes where" table of `docs/PLAN.md` as
 * data. It is ours, not Lectorium's: there the directions are symmetric and
 * every collection merges last-write-wins, while here the writing sides are
 * split, so a merge never has to guess who is right — it looks the field up.
 *
 * One table, both sides. The server uses it to drop fields a client is not
 * allowed to write on push; the device uses it to decide what a pull may
 * overwrite. Two implementations of the same rule could disagree; one cannot.
 */

import { EnrollmentSyncField, HomeworkSyncField, SyncCollection } from './types'

/**
 * `down` — the server writes, the device only reads.
 * `up` — the device writes, the server stores and hands it to reviewers.
 * `both` — each side writes its own fields, never the same one.
 */
export const SyncDirections = ['down', 'up', 'both'] as const
export type SyncDirection = (typeof SyncDirections)[number]

export const SYNC_DIRECTION: Readonly<Record<SyncCollection, SyncDirection>> = Object.freeze({
  courses: 'down',
  lessons: 'down',
  lesson_versions: 'down',

  // Up goes the request, down comes the decision.
  enrollments: 'both',

  // Up goes the answer, down comes the review status and the grade.
  homework: 'both',

  block_states: 'up',
})

/**
 * Who may write which field of a two-way collection.
 *
 * A name in both lists is not a contradiction: it is a field each side writes
 * for its own reason — `enrollments.status` is `pending` when the student asks
 * and `accepted` when the school answers. The server's claim wins on such a
 * field, because the answer supersedes the request.
 */
export interface SyncFieldOwnership<TField extends string> {
  readonly client: readonly TField[]
  readonly server: readonly TField[]
}

export interface SyncFieldOwners {
  readonly homework: SyncFieldOwnership<HomeworkSyncField>
  readonly enrollments: SyncFieldOwnership<EnrollmentSyncField>
}

export const FIELD_OWNER: Readonly<SyncFieldOwners> = Object.freeze({
  homework: Object.freeze({
    client: ['text', 'submittedAt'] as const,
    server: ['status', 'grade', 'reviewedById', 'reviewedAt', 'answeredSupersededVersion'] as const,
  }),
  enrollments: Object.freeze({
    client: ['status'] as const,
    server: ['status', 'decidedById', 'decidedAt', 'groupId'] as const,
  }),
})

/** The collections that carry a field-ownership table — exactly the two-way ones. */
export type TwoWaySyncCollection = keyof SyncFieldOwners

export const isTwoWaySyncCollection = (
  collection: SyncCollection,
): collection is TwoWaySyncCollection => SYNC_DIRECTION[collection] === 'both'

/**
 * The fields a client may write in `collection`, or an empty list when it may
 * write none. Used by push validation and by the merge, so "what the client
 * owns" is answered in one place.
 */
export const clientOwnedFields = (collection: SyncCollection): readonly string[] => {
  if (isTwoWaySyncCollection(collection)) return FIELD_OWNER[collection].client
  return SYNC_DIRECTION[collection] === 'up' ? ALL_FIELDS : NO_FIELDS
}

/**
 * The fields the server owns in `collection`. A `down` collection is the
 * server's entirely; an `up` collection carries nothing the server writes back.
 */
export const serverOwnedFields = (collection: SyncCollection): readonly string[] => {
  if (isTwoWaySyncCollection(collection)) return FIELD_OWNER[collection].server
  return SYNC_DIRECTION[collection] === 'down' ? ALL_FIELDS : NO_FIELDS
}

/**
 * Stands for "every field of the row", which cannot be listed by name because a
 * one-way collection has no field-level split to enumerate.
 */
export const ALL_FIELDS: readonly string[] = Object.freeze(['*'])

const NO_FIELDS: readonly string[] = Object.freeze([])

export const ownsEveryField = (fields: readonly string[]): boolean => fields === ALL_FIELDS
