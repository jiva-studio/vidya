import type { CourseId, EnrollmentId, GroupId, SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocalEnrollment, LocalGroup } from '@/ports'

import type { StartedSync } from '../sync'

const COURSE = asId<CourseId>('b6d40e27-8c31-4a95-b7f2-0e5a1d38c624')
const SCHOOL = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const GROUP = asId<GroupId>('1d6c8a35-4b29-4e07-9c58-3a7f2b6d1e40')
const REQUEST = asId<EnrollmentId>('4a7e2c96-0d13-4b58-9f26-3c8b1a5e70d4')

const group: LocalGroup = {
  id: GROUP,
  schoolId: SCHOOL,
  courseId: COURSE,
  name: 'Tuesday evenings',
  description: null,
  startsAt: null,
  status: 'pending',
}

const enrollment = {
  id: REQUEST,
  schoolId: SCHOOL,
  courseId: COURSE,
} as LocalEnrollment

/** What the app believes is running. Emptied to model a signed-out device. */
const running: StartedSync[] = []

vi.mock('../sync', () => ({ runningSyncs: () => running }))

const { NoConnectionError, useRepositories } = await import('../repositories')

const calls: string[] = []
const soon = vi.fn()

/** An engine whose writes only say they happened, and one that refuses them. */
const engineThat = (write: () => Promise<LocalEnrollment>): StartedSync =>
  ({
    engine: {
      enrollments: {
        list: async () => [enrollment],
        getById: async () => enrollment,
        getLiveByCourse: async () => enrollment,
        request: async () => {
          calls.push('request')
          return write()
        },
        withdraw: async () => {
          calls.push('withdraw')
          return write()
        },
        archive: async () => {
          calls.push('archive')
          return write()
        },
        unarchive: async () => {
          calls.push('unarchive')
          return write()
        },
      },
      groups: {
        listRecruitingByCourse: async () => [group],
        getById: async () => group,
      },
    },
    triggers: { soon, now: async () => ({}), stop: async () => {} },
  }) as unknown as StartedSync

const run = (started: StartedSync): void => {
  running.splice(0, running.length, started)
}

beforeEach(() => {
  running.length = 0
  calls.length = 0
  soon.mockClear()
})

/**
 * The device as the screens hold it: every write asks for a run, and a device
 * with no connection behind it reads empty rather than throwing.
 */
describe('the repositories the screens are given', () => {
  it('asks for a run after the student puts a request away', async () => {
    run(engineThat(async () => enrollment))

    await useRepositories().enrollments.archive(REQUEST)

    expect(calls).toEqual(['archive'])
    expect(soon).toHaveBeenCalledTimes(1)
  })

  it('asks for a run after the student takes it back', async () => {
    run(engineThat(async () => enrollment))

    await useRepositories().enrollments.unarchive(REQUEST)

    expect(calls).toEqual(['unarchive'])
    expect(soon).toHaveBeenCalledTimes(1)
  })

  it('asks for no run when the write was refused', async () => {
    // A refused write journaled nothing, and a run over it would be a network
    // call made for no row.
    run(engineThat(() => Promise.reject(new Error('refused'))))

    await expect(useRepositories().enrollments.archive(REQUEST)).rejects.toThrow('refused')
    expect(soon).not.toHaveBeenCalled()
  })

  it('reads the groups of the running engine', async () => {
    run(engineThat(async () => enrollment))

    expect(await useRepositories().groups.listRecruitingByCourse(COURSE)).toEqual([group])
    expect(await useRepositories().groups.getById(GROUP)).toEqual(group)
  })

  it('refuses every write while the app holds no connection', async () => {
    const device = useRepositories()

    await expect(device.enrollments.archive(REQUEST)).rejects.toBeInstanceOf(NoConnectionError)
    await expect(device.enrollments.unarchive(REQUEST)).rejects.toBeInstanceOf(NoConnectionError)
    await expect(device.enrollments.withdraw(REQUEST)).rejects.toBeInstanceOf(NoConnectionError)
    await expect(
      device.enrollments.request({ id: REQUEST, schoolId: SCHOOL, courseId: COURSE }),
    ).rejects.toBeInstanceOf(NoConnectionError)
  })

  it('reads an empty device while the app holds no connection', async () => {
    const device = useRepositories()

    expect(await device.enrollments.list()).toEqual([])
    expect(await device.enrollments.getLiveByCourse(COURSE)).toBeNull()
    expect(await device.groups.listRecruitingByCourse(COURSE)).toEqual([])
    expect(await device.groups.getById(GROUP)).toBeNull()
  })
})
