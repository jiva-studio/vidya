import type { LocalCourse, LocalEnrollment, LocalGroup } from '@vidya/client'
import { asId, type CourseId, type EnrollmentId, type GroupId } from '@vidya/domain'
import { computed, ref } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import { findPlace } from './findPlace'
import { resolveCourse } from './resolveCourse'

interface PlaceScreen {
  readonly course: LocalCourse | null
  readonly place: LocalEnrollment | null
  readonly group: LocalGroup | null
  readonly preferredGroup: LocalGroup | null
}

const NOTHING: PlaceScreen = { course: null, place: null, group: null, preferredGroup: null }

/**
 * One request, and everything the screen says about it.
 *
 * The identifier is kept once the request has been found, and every later read
 * goes by it. Putting a request away takes it out of the student's list, and a
 * screen that looked it up by course again would lose the row the moment it
 * was archived — together with the button that brings it back.
 *
 * The group the school placed the student in and the one they asked for are
 * read separately and both by identifier: an asked-for group that has since
 * stopped taking students is still the one the student named, and the listing
 * of open groups would no longer carry it.
 */
export const usePlaceView = (code: () => string, courseId: () => string) => {
  const schools = useLocalSchools()
  const education = useLocalEducation()
  const held = ref<EnrollmentId | null>(null)

  const readGroup = (id: string | null): Promise<LocalGroup | null> =>
    id === null ? Promise.resolve(null) : education.groups.getById(asId<GroupId>(id))

  const { data, reading, reload } = useLocalRead(
    async (): Promise<PlaceScreen> => {
      const school = await schools.getByCode(code())
      const course = resolveCourse(
        await education.courses.getById(asId<CourseId>(courseId())),
        school,
      )
      if (course === null) return NOTHING

      const place =
        held.value === null
          ? await findPlace(education, course.id)
          : await education.enrollments.getById(held.value)

      held.value = place?.id ?? null

      return {
        course,
        place,
        group: await readGroup(place?.groupId ?? null),
        preferredGroup: await readGroup(place?.preferredGroupId ?? null),
      }
    },
    NOTHING,
    [code, courseId],
  )

  return {
    course: computed(() => data.value.course),
    place: computed(() => data.value.place),
    group: computed(() => data.value.group),
    preferredGroup: computed(() => data.value.preferredGroup),
    reading,
    reload,
  }
}
