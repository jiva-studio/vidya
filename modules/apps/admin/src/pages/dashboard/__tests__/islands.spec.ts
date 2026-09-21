import type { PermissionKey } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { islandsFor } from '../model'

const granting =
  (...granted: PermissionKey[]) =>
  (permission: PermissionKey) =>
    granted.includes(permission)

const everything = () => true

const keysOf = (islands: { key: string }[]) => islands.map((island) => island.key)

describe('islandsFor', () => {
  it('offers nothing to a session that may read nothing', () => {
    expect(islandsFor(() => false, {})).toEqual([])
  })

  it('offers only what the role grants', () => {
    const islands = islandsFor(granting('homework:read'), { homework: 3 })

    expect(keysOf(islands)).toEqual(['homework'])
  })

  it('puts the queues above the ways in', () => {
    const islands = islandsFor(everything, { enrollments: 0, homework: 0 })

    expect(keysOf(islands).slice(0, 2)).toEqual(['enrollments', 'homework'])
  })

  it('puts the fullest queue first, whatever order they are declared in', () => {
    const islands = islandsFor(everything, { enrollments: 1, homework: 12 })

    expect(keysOf(islands).slice(0, 2)).toEqual(['homework', 'enrollments'])
  })

  it('keeps an empty queue on the page, so the way to it does not move', () => {
    const islands = islandsFor(granting('enrollments:read'), { enrollments: 0 })

    expect(islands).toEqual([expect.objectContaining({ key: 'enrollments', count: 0 })])
  })

  it('leaves the figure out when the count could not be read', () => {
    const [island] = islandsFor(granting('enrollments:read'), {})

    expect(island.count).toBeUndefined()
  })

  it('never puts a figure on a way in: a course is not overdue', () => {
    const islands = islandsFor(everything, { enrollments: 4, homework: 2 })
    const waysIn = islands.filter((island) => island.kind === 'way-in')

    expect(waysIn.length).toBeGreaterThan(0)
    expect(waysIn.every((island) => island.count === undefined)).toBe(true)
  })

  it('sorts an unreadable count below an empty one rather than above a full one', () => {
    const islands = islandsFor(everything, { homework: 0 })

    expect(keysOf(islands).slice(0, 2)).toEqual(['homework', 'enrollments'])
  })
})
