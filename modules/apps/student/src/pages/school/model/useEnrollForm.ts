import { education as scenarios, type LocalCourse, type LocalGroup } from '@vidya/client'
import { asId, type CourseId } from '@vidya/domain'
import { computed, ref } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'
import { useDeviceWrites } from '@/shared/sync'

import type { PlaceWish } from '../types'
import { resolveCourse } from './resolveCourse'
import { toChosenRanges } from './toChosenRanges'

interface EnrollScreen {
  readonly course: LocalCourse | null
  readonly groups: readonly LocalGroup[]
}

const NOTHING: EnrollScreen = { course: null, groups: [] }

/**
 * The form a student asks for a place with, and the one write it makes.
 *
 * Groups are the school's answer to "who is taking students", and only a
 * course taught in groups has any. Nothing here reaches the school: the
 * request is written down and journaled, so it survives a closed tab and
 * leaves on the next run.
 */
export const useEnrollForm = (code: () => string, courseId: () => string) => {
  const schools = useLocalSchools()
  const device = useLocalEducation()
  const writes = useDeviceWrites()

  const busy = ref(false)
  const failed = ref(false)

  const { data, reading } = useLocalRead(
    async (): Promise<EnrollScreen> => {
      const school = await schools.getByCode(code())
      const course = resolveCourse(await device.courses.getById(asId<CourseId>(courseId())), school)
      if (course === null) return NOTHING

      const groups =
        course.learningType === 'group' ? await device.groups.listRecruitingByCourse(course.id) : []

      return { course, groups }
    },
    NOTHING,
    [code, courseId],
  )

  /**
   * One place per course is the rule on both sides, so the request the student
   * may already hold is looked up first — and inside the guard against a
   * second click, which lands before the render that disables the button.
   */
  const ask = async (wish: PlaceWish): Promise<boolean> => {
    const enrollments = writes.enrollments.value
    const course = data.value.course
    if (busy.value || enrollments === undefined || course === null) return false

    busy.value = true
    failed.value = false

    try {
      const held = await device.enrollments.getLiveByCourse(course.id)
      if (held === null) await enrollments.request(toRequest(course, wish))

      return true
    } catch (error) {
      console.warn('the request for a place could not be written', error)
      failed.value = true

      return false
    } finally {
      busy.value = false
    }
  }

  return {
    course: computed(() => data.value.course),
    groups: computed(() => data.value.groups),
    writable: computed(() => writes.enrollments.value !== undefined),
    reading,
    busy,
    failed,
    ask,
  }
}

const toRequest = (course: LocalCourse, wish: PlaceWish) => {
  const written = wish.comment.trim()
  const times = scenarios.buildPreferredTimes(toChosenRanges(wish.times), scenarios.readTimeZone())

  return {
    id: scenarios.newEnrollmentId(),
    schoolId: course.schoolId,
    courseId: course.id,
    preferredGroupId: wish.preferredGroupId ?? undefined,
    preferredTimes: times ?? undefined,
    comment: written === '' ? undefined : written,
  }
}
