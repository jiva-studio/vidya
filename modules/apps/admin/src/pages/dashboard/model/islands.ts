import type { PermissionKey } from '@vidya/domain'

import type { DashboardIsland, IslandDefinition, Workload } from './types'

/**
 * The home screen, one island per thing a person in this school may do.
 *
 * Ordered by urgency rather than by the menu, so a full queue is never buried
 * under an empty one. An empty queue keeps its place: hiding it would move
 * every other card the moment the last request was answered.
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

// A count nobody could read is not a count of zero.
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
