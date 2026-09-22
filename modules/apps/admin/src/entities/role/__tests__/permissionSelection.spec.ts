import type { PermissionKey } from '@vidya/domain'
import { PermissionKeys } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { groupPermissions, groupState, splitGroups, toggleGroup, togglePermission } from '../model'
import type { PermissionGroup } from '../model/types'

const groupOf = (prefix: string) => {
  const group = groupPermissions().find((candidate) => candidate.prefix === prefix)
  if (!group) throw new Error(`no such group: ${prefix}`)
  return group
}

describe('groupState', () => {
  it('reads an untouched group as none', () => {
    expect(groupState(groupOf('courses'), [])).toBe('none')
  })

  it('reads a partly held group as some', () => {
    expect(groupState(groupOf('courses'), ['courses:read'] as PermissionKey[])).toBe('some')
  })

  it('reads a fully held group as all', () => {
    expect(groupState(groupOf('homework'), [...groupOf('homework').keys])).toBe('all')
  })

  it('ignores keys of other groups', () => {
    expect(groupState(groupOf('courses'), ['lessons:read'] as PermissionKey[])).toBe('none')
  })
})

describe('togglePermission', () => {
  it('adds exactly the key that was ticked', () => {
    expect(togglePermission([], 'lessons:publish' as PermissionKey, true)).toEqual([
      'lessons:publish',
    ])
  })

  it('removes exactly the key that was unticked', () => {
    const held = ['courses:read', 'courses:update'] as PermissionKey[]

    expect(togglePermission(held, 'courses:read' as PermissionKey, false)).toEqual([
      'courses:update',
    ])
  })

  it('never holds a key twice', () => {
    const held = ['courses:read'] as PermissionKey[]

    expect(togglePermission(held, 'courses:read' as PermissionKey, true)).toEqual(['courses:read'])
  })

  it('keeps the domain order, whatever order the keys arrived in', () => {
    const held = ['homework:grade', 'courses:read'] as PermissionKey[]

    expect(togglePermission(held, 'roles:read' as PermissionKey, true)).toEqual([
      'roles:read',
      'courses:read',
      'homework:grade',
    ])
  })
})

describe('toggleGroup', () => {
  it('takes every key of the group and nothing else', () => {
    const held = ['roles:read'] as PermissionKey[]

    expect(toggleGroup(held, groupOf('lessons'), true)).toEqual([
      'roles:read',
      'lessons:create',
      'lessons:read',
      'lessons:update',
      'lessons:delete',
      'lessons:publish',
    ])
  })

  it('drops every key of the group and leaves the rest', () => {
    const held = ['roles:read', 'homework:read', 'homework:grade'] as PermissionKey[]

    expect(toggleGroup(held, groupOf('homework'), false)).toEqual(['roles:read'])
  })

  it('takes the powers that are not verbs of the ladder along with the rest', () => {
    expect(toggleGroup([], groupOf('enrollments'), true)).toEqual([
      'enrollments:read',
      'enrollments:moderate',
    ])
  })

  it('offers no key the domain does not declare', () => {
    const everything = groupPermissions().reduce<PermissionKey[]>(
      (held, group) => toggleGroup(held, group, true),
      [],
    )

    expect(everything).toEqual([...PermissionKeys])
  })
})

describe('splitGroups', () => {
  const areas = () => groupPermissions().filter((group) => group.prefix !== 'all')

  it('deals every group into a column, losing none and splitting none', () => {
    const dealt = splitGroups(areas())

    expect(dealt.flat()).toEqual(areas())
  })

  it('keeps the domain order down one column and then the next', () => {
    const dealt = splitGroups(areas())

    expect(dealt[0][0].prefix).toBe('roles')
    expect(dealt[1][0].prefix).toBe('lessons')
  })

  // A column is a place to put things, so it is never skipped over: a first
  // group taller than the share must land in it rather than past it.
  const tallFirst = (): PermissionGroup[] => [
    { prefix: 'huge', keys: Array.from({ length: 20 }, (_, at) => `huge:${at}` as PermissionKey) },
    { prefix: 'a', keys: ['a:read' as PermissionKey] },
    { prefix: 'b', keys: ['b:read' as PermissionKey] },
  ]

  for (const columns of [2, 3, 4]) {
    it(`leaves no column empty while a later one is filled, across ${columns} columns`, () => {
      const dealt = splitGroups(tallFirst(), columns)
      const lastFilled = dealt.reduce((at, column, index) => (column.length > 0 ? index : at), -1)

      expect(dealt.slice(0, lastFilled + 1).map((column) => column.length > 0)).not.toContain(false)
    })
  }

  it('puts the first group in the first column, however tall it is', () => {
    expect(splitGroups(tallFirst(), 3)[0].map((group) => group.prefix)).toEqual(['huge'])
  })

  it('leaves the columns within a row of each other in height', () => {
    const rows = (column: typeof areas extends () => infer T ? T : never) =>
      column.reduce((total, group) => total + group.keys.length + 1, 0)
    const [left, right] = splitGroups(areas())

    expect(Math.abs(rows(left) - rows(right))).toBeLessThanOrEqual(6)
  })
})
