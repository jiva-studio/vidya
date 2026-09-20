import type {
  GroupId,
  GroupStatus,
  IsoDateTime,
  PreferredTimes,
  SchoolId,
  UserId,
} from '@vidya/domain'

import type { EnrollmentDetails } from '../enrollments'
import type {
  CreateGroupRequest,
  GroupDetails,
  GroupSyncDetails,
  UpdateGroupRequest,
} from '../groups'

/**
 * The shapes behind the field lists, checked where only the compiler can see.
 *
 * `syncFields.spec.ts` checks the names; nothing there notices that a name was
 * added to the wrong type. The distinction matters most for groups:
 * `CreateGroupRequest` is `GroupDetails` without its id and
 * `UpdateGroupRequest` is `Partial<GroupDetails>`, so widening `GroupDetails`
 * to carry `status` would make the recruitment switch an ordinary `PATCH`
 * field — the transition would leave through the admin console, around the
 * button that stamps `startsAt`. The sync shape is therefore a type of its own.
 *
 * A failure here is a compilation failure, which is the only form this check
 * can take: types are gone by the time a test runs.
 */

/** Compiles only when a value of type `Narrow` may be stored in `T[K]`. */
type Accepts<T, K extends keyof T, Narrow> = [Narrow] extends [T[K]] ? true : never

/** Compiles only when `K` is not a key of `T`. */
type Lacks<T, K extends PropertyKey> = K extends keyof T ? never : true

const holds = <T extends true>(_witness?: T): void => undefined

describe('the group shapes on the wire', () => {
  it('sends the school, the start and the status beside the card', () => {
    holds<Accepts<GroupSyncDetails, 'schoolId', SchoolId>>()
    holds<Accepts<GroupSyncDetails, 'status', GroupStatus>>()

    // A group that has not started yet has no date, and the wire has to be
    // able to say so: `startsAt` is stamped when recruitment closes.
    holds<Accepts<GroupSyncDetails, 'startsAt', null>>()

    // Everything the card already carried travels with it.
    holds<Accepts<GroupSyncDetails, 'id', GroupDetails['id']>>()
    holds<Accepts<GroupSyncDetails, 'courseId', GroupDetails['courseId']>>()
    holds<Accepts<GroupSyncDetails, 'name', GroupDetails['name']>>()
  })

  it('keeps the recruitment switch out of the CRUD requests', () => {
    holds<Lacks<GroupDetails, 'status'>>()
    holds<Lacks<GroupDetails, 'startsAt'>>()
    holds<Lacks<CreateGroupRequest, 'status'>>()
    holds<Lacks<UpdateGroupRequest, 'status'>>()
  })
})

describe('the enrolment shape on the wire', () => {
  it('carries the request the student made', () => {
    holds<Accepts<EnrollmentDetails, 'preferredGroupId', GroupId>>()
    holds<Accepts<EnrollmentDetails, 'preferredTimes', PreferredTimes>>()
    holds<Accepts<EnrollmentDetails, 'comment', string>>()
  })

  it('carries both sides of the archiving, one of them for the console only', () => {
    holds<Accepts<EnrollmentDetails, 'archivedByStudentAt', IsoDateTime>>()
    holds<Accepts<EnrollmentDetails, 'archivedBySchoolAt', IsoDateTime>>()
    holds<Accepts<EnrollmentDetails, 'archivedBySchoolById', UserId>>()
  })
})
