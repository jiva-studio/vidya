import type { PermissionGroup } from './types'

const heightOf = (group: PermissionGroup): number => group.keys.length + 1

/**
 * The groups dealt into columns, in the order the domain lists them.
 *
 * A group is never split, and a column is filled until it holds its share of
 * the rows, so the two columns end up close in height without any of them
 * being stretched to match the other.
 */
export const splitGroups = (groups: PermissionGroup[], columns = 2): PermissionGroup[][] => {
  const share = groups.reduce((rows, group) => rows + heightOf(group), 0) / columns
  const dealt: PermissionGroup[][] = Array.from({ length: columns }, () => [])
  let column = 0
  let filled = 0

  for (const group of groups) {
    if (filled >= share * (column + 1) && column < columns - 1) column += 1
    dealt[column].push(group)
    filled += heightOf(group)
  }

  return dealt
}
