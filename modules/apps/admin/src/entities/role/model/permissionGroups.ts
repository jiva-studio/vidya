import type { PermissionKey } from '@vidya/domain'
import { PermissionKeys } from '@vidya/domain'

import type { PermissionGroup } from './types'

const ALL = '*'

/** The wildcard has no prefix of its own; it is given one so grouping stays total. */
export const WILDCARD_GROUP = 'all'

/** `roles:create` belongs to `roles`; `*` belongs to a group of its own. */
export const prefixOf = (key: PermissionKey): string =>
  key === ALL ? WILDCARD_GROUP : key.split(':')[0]

/** `roles:create` is a `create`; `*` is an `all`. */
export const actionOf = (key: PermissionKey): string =>
  key === ALL ? WILDCARD_GROUP : key.split(':')[1]

/**
 * The permission list as the role form draws it.
 *
 * The keys come from `@vidya/domain` and are grouped here rather than copied
 * into a list of the admin's own: a second list is how the interface ends up
 * offering a right the server has dropped, or hiding one it has added.
 */
export const groupPermissions = (
  keys: readonly PermissionKey[] = PermissionKeys,
): PermissionGroup[] => {
  const order: string[] = []
  const byPrefix = new Map<string, PermissionKey[]>()

  for (const key of keys) {
    const prefix = prefixOf(key)
    const bucket = byPrefix.get(prefix)

    if (bucket) {
      bucket.push(key)
      continue
    }

    byPrefix.set(prefix, [key])
    order.push(prefix)
  }

  return order.map((prefix) => ({ prefix, keys: byPrefix.get(prefix) ?? [] }))
}
