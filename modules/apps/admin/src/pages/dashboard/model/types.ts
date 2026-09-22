import type { PermissionKey } from '@vidya/domain'

/**
 * A card that counts what is waiting, or one that is only a way in.
 *
 * A queue's number promises somebody is waiting on an answer; a section that
 * is never overdue gets none, or the screen becomes a scoreboard.
 */
export type IslandKind = 'queue' | 'way-in'

export interface IslandDefinition {
  key: string
  kind: IslandKind
  route: string
  permission: PermissionKey
}

/** `count` is absent on a way in, and when the figure could not be read. */
export type DashboardIsland = IslandDefinition & { count?: number }

/** What each queue is holding, as far as this session may read it. */
export interface Workload {
  enrollments?: number
  homework?: number
}
