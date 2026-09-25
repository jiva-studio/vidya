import type { CourseId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { LessonSummary, LessonVersionSummary } from '@vidya/protocol'
import { computed, isRef, onMounted, type Ref, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

import { createLesson, getLessons, getLessonVersions } from '../api'
import type { LessonRow } from '../types'
import { draftVersionOf, lessonVersionState, publishedVersionOf } from './versionState'

const toRow = (lesson: LessonSummary, versions: LessonVersionSummary[]): LessonRow => ({
  id: lesson.id,
  courseId: lesson.courseId,
  lessonNumber: lesson.lessonNumber,
  title: lesson.title,
  state: lessonVersionState(versions),
  publishedVersion: publishedVersionOf(versions),
  draftVersion: draftVersionOf(versions),
})

/**
 * The lessons of a school or course, each with the state of its latest version.
 *
 * The versions come one request per lesson because `LessonSummary` carries no
 * version field and `GET /edu/lessons` offers no way to ask for them. They go
 * out together rather than in sequence, and the whole page is one round of
 * fan-out rather than one request per row as the operator scrolls.
 */
export const useCourseLessons = (courseIdArg?: Ref<string> | string) => {
  const http = useHttp()
  const { generation } = useCurrentSchool()

  const courseId = isRef(courseIdArg) ? courseIdArg : ref(courseIdArg ?? '')
  const query = ref('')

  const allRows = ref<LessonRow[]>([])
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)
  const addError = ref<string | undefined>(undefined)

  let ticket = 0

  const load = async (): Promise<void> => {
    const mine = ++ticket

    allRows.value = []
    loading.value = true
    error.value = undefined

    try {
      const selectedCourse = courseId.value ? asId<CourseId>(courseId.value) : undefined
      const { items } = await getLessons(http, { courseId: selectedCourse })
      const versions = await Promise.all(items.map((lesson) => getLessonVersions(http, lesson.id)))
      if (mine !== ticket) return
      allRows.value = items.map((lesson, index) => toRow(lesson, versions[index].items))
    } catch (caught) {
      if (mine !== ticket) return
      error.value = reasonOf(caught, 'lessons-load-failed')
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  const rows = computed<LessonRow[]>(() => {
    const term = query.value.trim().toLowerCase()
    if (!term) return allRows.value
    return allRows.value.filter((row) => row.title.toLowerCase().includes(term))
  })

  /** The number is the list's business: the next one, never typed by hand. */
  const add = async (title: string, targetCourseId?: string): Promise<boolean> => {
    const target = asId<CourseId>(targetCourseId || courseId.value)
    const courseLessons = allRows.value.filter((row) => row.courseId === target)
    const next = Math.max(0, ...courseLessons.map((row) => row.lessonNumber)) + 1
    addError.value = undefined

    try {
      await createLesson(http, target, next, title)
      await load()
      return true
      // Kept apart from the list's own error: a failed add must not replace the
      // lessons on screen with an error state.
    } catch (caught) {
      addError.value = reasonOf(caught, 'lesson-create-failed')
      return false
    }
  }

  watch([generation, courseId], () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return {
    rows,
    allRows,
    loading,
    error,
    addError,
    courseId,
    query,
    find: (term: string) => {
      query.value = term
    },
    reload: load,
    add,
  }
}
