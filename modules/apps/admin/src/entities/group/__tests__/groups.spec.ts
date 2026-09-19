import type { CourseId, EnrollmentId, GroupId, SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '@/shared/testing'

import {
  createGroup,
  getEnrollment,
  getGroup,
  getGroupEnrollments,
  getGroups,
  getSchoolUserNames,
  updateGroup,
} from '../api'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSE = asId<CourseId>('22222222-2222-2222-2222-222222222222')
const GROUP = asId<GroupId>('44444444-4444-4444-4444-444444444444')
const ENROLLMENT = asId<EnrollmentId>('55555555-5555-5555-5555-555555555555')

const GROUPS = '/edu/groups'
const ENROLLMENTS = '/edu/enrollments'
const USERS = '/edu/users'

const values = { name: 'Morning group', courseId: COURSE, description: 'Tuesdays at seven' }

const transport = () =>
  fakeHttpClient({
    [GROUPS]: { items: [] },
    [ENROLLMENTS]: { items: [] },
    [USERS]: { items: [{ id: 'u1', name: 'Anna' }] },
  })

describe('group requests', () => {
  it('asks for the groups of one course when a course is chosen', async () => {
    const fake = transport()

    await getGroups(fake.client, { courseId: COURSE })

    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: GROUPS,
      query: { courseId: COURSE },
    })
  })

  it('reads one group by its id', async () => {
    const fake = transport()

    await getGroup(fake.client, GROUP)

    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: `${GROUPS}/${GROUP}` })
  })

  it('creates a group with the course, the name and the description, and nothing else', async () => {
    const fake = transport()

    await createGroup(fake.client, values)

    const call = fake.calls[0]
    expect(call).toMatchObject({ method: 'POST', path: GROUPS })
    expect(call.body).toEqual({
      courseId: COURSE,
      name: 'Morning group',
      description: 'Tuesdays at seven',
    })
  })

  it('never sends a start date or a teacher, whatever the archive showed', async () => {
    const fake = transport()

    await createGroup(fake.client, values)

    const body = fake.calls[0].body as Record<string, unknown>
    expect(body.startsAt).toBeUndefined()
    expect(body.teacherId).toBeUndefined()
  })

  it('updates a group without moving it to another course', async () => {
    const fake = transport()

    await updateGroup(fake.client, GROUP, values)

    const call = fake.calls[0]
    expect(call).toMatchObject({ method: 'PATCH', path: `${GROUPS}/${GROUP}` })
    expect(Object.keys(call.body as Record<string, unknown>).sort()).toEqual([
      'description',
      'name',
    ])
  })

  it('reads a roster as the enrolments pointing at the group', async () => {
    const fake = transport()

    await getGroupEnrollments(fake.client, GROUP)

    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: ENROLLMENTS,
      query: { groupId: GROUP },
    })
  })

  it('reads one enrolment, because the summary carries no student', async () => {
    const fake = transport()

    await getEnrollment(fake.client, ENROLLMENT)

    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: `${ENROLLMENTS}/${ENROLLMENT}` })
  })

  it('resolves every name in one request rather than one per member', async () => {
    const fake = transport()

    const names = await getSchoolUserNames(fake.client, SCHOOL)

    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: USERS, query: { schoolId: SCHOOL } })
    expect(names.get(asId('u1'))).toBe('Anna')
  })

  it('leaves the roster nameless rather than failing when names may not be read', async () => {
    const fake = fakeHttpClient({ [USERS]: new Error('forbidden') })

    await expect(getSchoolUserNames(fake.client, SCHOOL)).resolves.toEqual(new Map())
  })
})
