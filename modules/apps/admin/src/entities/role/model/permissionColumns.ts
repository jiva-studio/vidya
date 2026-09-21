import type { PermissionGroup } from './types'

const heightOf = (group: PermissionGroup): number => group.keys.length + 1

/**
 * The groups dealt into columns, in the order the domain lists them.
 *
 * A group is never split, and a column takes one more group only while that
 * leaves it closer to its share of the rows than stopping short would. Waiting
 * until the share is exceeded before moving on is what lets a tall group land
 * wholly on one side: the column overshoots by its full height, and the last
 * one absorbs the difference — five keys added to the domain were enough to
 * open a seven-row gap that way.
 */
export const splitGroups = (groups: PermissionGroup[], columns = 2): PermissionGroup[][] => {
  const share = groups.reduce((rows, group) => rows + heightOf(group), 0) / columns
  const dealt: PermissionGroup[][] = Array.from({ length: columns }, () => [])
  let column = 0
  let filled = 0

  for (const group of groups) {
    const target = share * (column + 1)
    const overshoots = Math.abs(filled + heightOf(group) - target) > Math.abs(filled - target)

    if (overshoots && column < columns - 1) column += 1
    dealt[column].push(group)
    filled += heightOf(group)
  }

  return dealt
}
