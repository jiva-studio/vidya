import type { PermissionKey } from '@vidya/domain'

/**
 * A card that counts what is waiting, or one that is only a way into a section.
 *
 * The distinction is not decoration: a queue's number is a promise that someone
 * is waiting on an answer, and putting a number on a section that is never
 * overdue turns the home screen into a scoreboard.
 */
export type IslandKind = 'queue' | 'way-in'

export interface IslandDefinition {
  key: string
  kind: IslandKind
  route: string
  permission: PermissionKey
}

export type DashboardIsland = IslandDefinition & {
  /** How many are waiting. Absent on a way in, and when the count was refused. */
  count?: number
}

/** What each queue is holding, as far as this session may read it. */
export interface Workload {
  enrollments?: number
  homework?: number
}
