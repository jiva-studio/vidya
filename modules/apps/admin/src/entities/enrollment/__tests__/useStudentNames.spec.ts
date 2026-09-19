import type { UserId } from '@vidya/domain'
import { describe, expect, it, vi } from 'vitest'

import { useStudentNames } from '../model'

const id = (value: string) => value as UserId

describe('useStudentNames', () => {
  it('reads every unknown person once, in one batch', async () => {
    const lookup = vi.fn(async (who: UserId) => `Name of ${who}`)
    const students = useStudentNames(lookup)

    await students.resolve([id('u1'), id('u2')])

    expect(lookup).toHaveBeenCalledTimes(2)
    expect(students.names.value.get(id('u1'))).toBe('Name of u1')
    expect(students.names.value.get(id('u2'))).toBe('Name of u2')
  })

  it('does not ask again for a person it has already resolved', async () => {
    const lookup = vi.fn(async (who: UserId) => `Name of ${who}`)
    const students = useStudentNames(lookup)

    await students.resolve([id('u1'), id('u1'), id('u2')])
    await students.resolve([id('u1'), id('u2')])

    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('does not ask again for a person it failed to read', async () => {
    const lookup = vi.fn(async () => {
      throw new Error('no right to read people')
    })
    const students = useStudentNames(lookup)

    await students.resolve([id('u1')])
    await students.resolve([id('u1')])

    expect(lookup).toHaveBeenCalledTimes(1)
    expect(students.names.value.has(id('u1'))).toBe(false)
  })

  it('ignores the identifiers a summary did not carry', async () => {
    const lookup = vi.fn(async (who: UserId) => `Name of ${who}`)
    const students = useStudentNames(lookup)

    await students.resolve([undefined, undefined])

    expect(lookup).not.toHaveBeenCalled()
  })
})
