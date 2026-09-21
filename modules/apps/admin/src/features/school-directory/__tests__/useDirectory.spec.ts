import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCurrentSchool } from '@/shared/access'
import { httpClientKey, resetApi } from '@/shared/api'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import { useDirectory } from '../model'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const OTHER = asId<SchoolId>('22222222-2222-2222-2222-222222222222')

const COURSES = '/edu/courses'
const GROUPS = '/edu/groups'

const token = (permissions: unknown) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const signIn = (schools: SchoolId[]) =>
  useSession().start({
    accessToken: token(schools.map((sid) => ({ sid, p: ['*'] }))),
    refreshToken: 'refresh',
  })

/** The composable, mounted so it has an owner, with the transport it saw. */
const open = (answers: FakeAnswers) => {
  const transport = fakeHttpClient(answers)
  let directory!: ReturnType<typeof useDirectory>

  mountWithApp(
    {
      setup() {
        directory = useDirectory()
        return () => null
      },
    },
    { global: { provide: { [httpClientKey as symbol]: transport.client } } },
  )

  return { directory, transport }
}

const world = (over: FakeAnswers = {}): FakeAnswers => ({
  [COURSES]: { items: [{ id: 'c1', name: 'Foundations' }] },
  [GROUPS]: { items: [{ id: 'g1', courseId: 'c1', name: 'Morning', status: 'pending' }] },
  ...over,
})

describe('useDirectory', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signIn([SCHOOL, OTHER])
    useCurrentSchool().select(SCHOOL)
  })

  it('reads the courses and the groups once for a school', async () => {
    const { directory, transport } = open(world())

    await directory.load()
    await directory.load()

    expect(transport.callsTo(COURSES)).toHaveLength(1)
    expect(transport.callsTo(GROUPS)).toHaveLength(1)
  })

  it('keeps the whole group, not only its name, so a caller can ask its status', async () => {
    const { directory } = open(world())

    await directory.load()

    expect(directory.groupsById.value.get(asId('g1'))).toMatchObject({
      courseId: 'c1',
      status: 'pending',
    })
    expect(directory.groupsUnreadable.value).toBe(false)
  })

  // Refused and "this school has no groups" are the same empty list, and a
  // caller that confuses them places a student on nothing.
  it('says the groups were unreadable rather than reporting none', async () => {
    const { directory } = open(world({ [GROUPS]: refusal(403, 'Forbidden') }))

    await directory.load()

    expect(directory.groupsUnreadable.value).toBe(true)
    expect(directory.groupNames.value.size).toBe(0)
  })

  it('keeps the courses it did read when the groups are refused', async () => {
    const { directory } = open(world({ [GROUPS]: refusal(403, 'Forbidden') }))

    await directory.load()

    expect(directory.courseNames.value.size).toBe(1)
  })

  it('tries again after a refusal instead of settling the question for the session', async () => {
    let refuse = true
    const { directory, transport } = open(
      world({
        [GROUPS]: () => {
          if (refuse) throw refusal(403, 'Forbidden')
          return { items: [{ id: 'g1', courseId: 'c1', name: 'Morning', status: 'pending' }] }
        },
      }),
    )

    await directory.load()
    refuse = false
    await directory.load()

    expect(transport.callsTo(GROUPS)).toHaveLength(2)
    expect(directory.groupsUnreadable.value).toBe(false)
    expect(directory.groupNames.value.size).toBe(1)
  })

  it('stops asking once both reads have worked', async () => {
    const { directory, transport } = open(world())

    await directory.load()
    await directory.load()
    await directory.load()

    expect(transport.callsTo(GROUPS)).toHaveLength(1)
  })
})
