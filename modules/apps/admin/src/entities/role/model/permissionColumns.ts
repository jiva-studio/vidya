import type { PermissionGroup } from './types'

const heightOf = (group: PermissionGroup): number => group.keys.length + 1

/**
 * The groups dealt into columns, in the order the domain lists them.
 *
 * A group is never split: a column takes one more group only while that leaves
 * it closer to its share of the rows than stopping short would, and the last
 * column absorbs whatever the earlier ones overshot by. A column still empty
 * keeps the group it is offered whatever its height, because moving on would
 * leave a gap on the screen no later group can fill.
 */
export const splitGroups = (groups: PermissionGroup[], columns = 2): PermissionGroup[][] => {
  const share = groups.reduce((rows, group) => rows + heightOf(group), 0) / columns
  const dealt: PermissionGroup[][] = Array.from({ length: columns }, () => [])
  let column = 0
  let filled = 0

  for (const group of groups) {
    const target = share * (column + 1)
    const overshoots = Math.abs(filled + heightOf(group) - target) > Math.abs(filled - target)

    if (overshoots && dealt[column].length > 0 && column < columns - 1) column += 1
    dealt[column].push(group)
    filled += heightOf(group)
  }

  return dealt
}
