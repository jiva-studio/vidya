import type { PermissionKey } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import type { Workload } from '../model'
import { ISLANDS, islandsFor } from '../model'

const everything = () => true
const nothing = () => false

const keysOf = (islands: { key: string }[]) => islands.map((island) => island.key)

describe('islandsFor boundaries', () => {
  it('offers nothing when nothing is granted, and every island when all is', () => {
    expect(islandsFor(nothing, { enrollments: 9, homework: 9 })).toEqual([])
    expect(keysOf(islandsFor(everything, {}))).toHaveLength(ISLANDS.length)
  })

  it('reads an empty workload as counts nobody could read', () => {
    const queues = islandsFor(everything, {}).filter((island) => island.kind === 'queue')

    expect(queues.length).toBeGreaterThan(0)
    expect(queues.every((island) => island.count === undefined)).toBe(true)
  })

  it('ignores a figure carried under a key no island claims', () => {
    const workload = { lessons: 40 } as unknown as Workload

    expect(islandsFor(everything, workload).every((island) => island.count === undefined)).toBe(
      true,
    )
  })

  it('keeps a negative count below an empty queue rather than above it', () => {
    const islands = islandsFor(everything, { enrollments: -3, homework: 0 })

    expect(keysOf(islands).slice(0, 2)).toEqual(['homework', 'enrollments'])
  })

  it('sorts counts too large to fit a badge by size, not by text', () => {
    const islands = islandsFor(everything, { enrollments: 9, homework: Number.MAX_SAFE_INTEGER })

    expect(keysOf(islands).slice(0, 2)).toEqual(['homework', 'enrollments'])
  })

  it('leaves equal queues in the order they are declared, on every call', () => {
    const first = keysOf(islandsFor(everything, { enrollments: 4, homework: 4 }))
    const second = keysOf(islandsFor(everything, { enrollments: 4, homework: 4 }))

    expect(first).toEqual(second)
    expect(first.slice(0, 2)).toEqual(['enrollments', 'homework'])
  })

  it('never lets a way in carry a figure, however the workload is filled', () => {
    const workload = { enrollments: 7, homework: 0, courses: 5, groups: 5 } as unknown as Workload
    const waysIn = islandsFor(everything, workload).filter((island) => island.kind === 'way-in')

    expect(keysOf(waysIn)).toEqual(['courses', 'groups', 'users'])
    expect(waysIn.every((island) => island.count === undefined)).toBe(true)
  })

  // The list is frozen so that a sort cannot reorder the declaration other
  // callers read.
  it('hands back a fresh list and leaves the declarations untouched', () => {
    const before = keysOf([...ISLANDS])

    islandsFor(everything, { enrollments: 0, homework: 99 })

    expect(keysOf([...ISLANDS])).toEqual(before)
  })

  it('grants a single queue without letting the ways in overtake it', () => {
    const islands = islandsFor(
      (permission: PermissionKey) => permission === ('homework:read' as PermissionKey),
      { homework: 0 },
    )

    expect(islands).toEqual([expect.objectContaining({ key: 'homework', count: 0 })])
  })
})
