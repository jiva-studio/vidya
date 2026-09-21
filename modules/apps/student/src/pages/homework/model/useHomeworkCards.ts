import type { LocalLessonVersion } from '@vidya/client'
import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import type { HomeworkCard } from '../types'
import { toHomeworkCards } from './toHomeworkCards'

/**
 * Every answer this student has written, across every school they belong to.
 *
 * The list is read from the places they hold, because homework is stored
 * against a place and there is no other way in. The lessons are then looked up
 * one version at a time rather than listed: a device holds the versions of the
 * courses it downloaded, and the ones behind these answers are a handful.
 */
export const useHomeworkCards = () => {
  const schools = useLocalSchools()
  const education = useLocalEducation()

  const { data, reading } = useLocalRead<HomeworkCard[]>(async () => {
    const places = await education.enrollments.list()
    const answers = (
      await Promise.all(places.map((place) => education.homework.listByEnrollment(place.id)))
    ).flat()

    const versions = (
      await Promise.all(
        [...new Set(answers.map((answer) => answer.lessonVersionId))].map((id) =>
          education.lessonVersions.getById(id),
        ),
      )
    ).filter((version): version is LocalLessonVersion => version !== null)

    const lessons = (
      await Promise.all(versions.map((version) => education.lessons.getById(version.lessonId)))
    ).filter((lesson) => lesson !== null)

    const courses = (
      await Promise.all(
        [...new Set(lessons.map((lesson) => lesson.courseId))].map((id) =>
          education.courses.getById(id),
        ),
      )
    ).filter((course) => course !== null)

    return toHomeworkCards({
      answers,
      versions,
      lessons,
      courses,
      schools: await schools.list(),
    })
  }, [])

  return { cards: computed(() => data.value), reading }
}
