import type { EnrollmentId, GroupId, UserId } from '@vidya/domain'
import { onMounted, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

import { getEnrollment, getGroupEnrollments, getSchoolUserNames, getUserName } from '../api'
import type { GroupMember } from '../types'

/**
 * Who is in a group.
 *
 * Membership lives on the enrolment, and `EnrollmentSummary` carries neither
 * the student nor a name, so the roster reads each enrolment for its student
 * and then resolves every name in a single request rather than one per row.
 *
 * That list only holds people with a role, and an accepted student need hold
 * none, so whoever it leaves unnamed is read one at a time — unless it was
 * refused, when every one of those reads is refused too.
 */
export const useGroupMembers = (groupId: GroupId) => {
  const http = useHttp()
  const { schoolId, generation } = useCurrentSchool()

  const members = ref<GroupMember[]>([])
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  let ticket = 0

  const readStudents = async (ids: EnrollmentId[]): Promise<GroupMember[]> => {
    const details = await Promise.all(ids.map((id) => getEnrollment(http, id)))

    return details.map((enrollment) => ({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      enrolledAt: enrollment.createdAt,
    }))
  }

  const named = (roster: GroupMember[], names: Map<UserId, string>): GroupMember[] =>
    roster.map((member) => ({
      ...member,
      name: member.studentId ? names.get(member.studentId) : undefined,
    }))

  const fillGaps = async (
    roster: GroupMember[],
    names: Map<UserId, string>,
  ): Promise<Map<UserId, string>> => {
    const missing = [
      ...new Set(
        roster
          .map((member) => member.studentId)
          .filter((id): id is UserId => !!id && !names.has(id)),
      ),
    ]

    const read = await Promise.all(
      missing.map(async (id) => [id, await getUserName(http, id)] as const),
    )

    const filled = new Map(names)
    for (const [id, name] of read) if (name) filled.set(id, name)

    return filled
  }

  const load = async (): Promise<void> => {
    const mine = ++ticket
    const school = schoolId.value

    members.value = []
    loading.value = true
    error.value = undefined

    try {
      const { items } = await getGroupEnrollments(http, groupId)
      const roster = await readStudents(items.map((item) => item.id))
      const listed = school
        ? await getSchoolUserNames(http, school)
        : { names: new Map<UserId, string>(), refused: true }

      const names = listed.refused ? listed.names : await fillGaps(roster, listed.names)
      if (mine !== ticket) return
      members.value = named(roster, names)
    } catch (caught) {
      if (mine !== ticket) return
      error.value = reasonOf(caught, 'group-members-load-failed')
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  watch(generation, () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return { members, loading, error, reload: load }
}
