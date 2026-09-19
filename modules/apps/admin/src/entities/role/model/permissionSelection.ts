import type { PermissionKey } from '@vidya/domain'
import { PermissionKeys } from '@vidya/domain'

import type { PermissionGroup, PermissionGroupState } from './types'

const rank = new Map<string, number>(PermissionKeys.map((key, index) => [key, index]))

const inDomainOrder = (keys: Iterable<PermissionKey>): PermissionKey[] =>
  [...keys].sort((left, right) => (rank.get(left) ?? 0) - (rank.get(right) ?? 0))

/** How much of one group is held: none of it, part of it, or all of it. */
export const groupState = (
  group: PermissionGroup,
  held: readonly PermissionKey[],
): PermissionGroupState => {
  const owned = group.keys.filter((key) => held.includes(key)).length

  if (owned === 0) return 'none'
  return owned === group.keys.length ? 'all' : 'some'
}

export const togglePermission = (
  held: readonly PermissionKey[],
  key: PermissionKey,
  on: boolean,
): PermissionKey[] => {
  const next = new Set(held)
  if (on) next.add(key)
  else next.delete(key)

  return inDomainOrder(next)
}

export const toggleGroup = (
  held: readonly PermissionKey[],
  group: PermissionGroup,
  on: boolean,
): PermissionKey[] => {
  const next = new Set(held)
  for (const key of group.keys) {
    if (on) next.add(key)
    else next.delete(key)
  }

  return inDomainOrder(next)
}
