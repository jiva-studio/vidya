import type { PermissionKey } from '@vidya/domain'

import type { DashboardIsland, IslandDefinition, Workload } from './types'

/**
 * The home screen, one island per thing a person in this school may do.
 *
 * Two kinds, and the order between them is the point. A queue is work someone
 * is waiting on and carries how much of it there is; a way in is a shortcut to
 * a section that is never "waiting" — a course is not overdue. Queues come
 * first, and among them the fullest, because a home screen that sorted by a
 * fixed menu order would bury forty requests under an empty one.
 *
 * A queue with nothing in it stays on the page. Hiding it would move every
 * other card the moment the last request was answered, and would hide the way
 * to the empty list from whoever wanted to look at it.
 */
export const ISLANDS: readonly IslandDefinition[] = Object.freeze([
  {
    key: 'enrollments',
    kind: 'queue',
    route: 'enrollments',
    permission: 'enrollments:read' as PermissionKey,
  },
  {
    key: 'homework',
    kind: 'queue',
    route: 'homework-queue',
    permission: 'homework:read' as PermissionKey,
  },
  { key: 'courses', kind: 'way-in', route: 'courses', permission: 'courses:read' as PermissionKey },
  { key: 'groups', kind: 'way-in', route: 'groups', permission: 'groups:read' as PermissionKey },
  { key: 'users', kind: 'way-in', route: 'users', permission: 'users:read' as PermissionKey },
])

const QUEUES_FIRST = { queue: 0, 'way-in': 1 } as const

// A count nobody could read is not a count of zero: the card says so rather
// than claiming an empty queue the reader has no right to see.
const countOf = (definition: IslandDefinition, workload: Workload): number | undefined =>
  definition.kind === 'queue' ? workload[definition.key as keyof Workload] : undefined

const byUrgency = (a: DashboardIsland, b: DashboardIsland): number => {
  const kinds = QUEUES_FIRST[a.kind] - QUEUES_FIRST[b.kind]
  if (kinds !== 0) return kinds

  return (b.count ?? -1) - (a.count ?? -1)
}

/** The islands this session may see, fullest queue first. */
export const islandsFor = (
  granted: (permission: PermissionKey) => boolean,
  workload: Workload,
): DashboardIsland[] =>
  ISLANDS.filter((definition) => granted(definition.permission))
    .map((definition) => ({ ...definition, count: countOf(definition, workload) }))
    .sort(byUrgency)
