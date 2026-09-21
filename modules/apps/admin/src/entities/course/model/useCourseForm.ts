import type { CourseId } from '@vidya/domain'
import { ref } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

import { createCourse, getCourse, updateCourse } from '../api'
import type { CourseFormValues } from '../types'

// A course is born out of sight: it is shown to students when someone says so.
const blank = (): CourseFormValues => ({
  name: '',
  description: '',
  learningType: 'individual',
  status: 'draft',
})

/**
 * Creating and editing a course, which is one screen and one request shape.
 *
 * The school is read when the course is created, not when the form is opened,
 * so a switch made while the form is on screen cannot file the course under
 * the school the operator has left.
 */
export const useCourseForm = (courseId?: CourseId) => {
  const http = useHttp()
  const { schoolId } = useCurrentSchool()

  const values = ref<CourseFormValues>(blank())
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | undefined>(undefined)

  const load = async (): Promise<void> => {
    if (!courseId) return

    loading.value = true
    error.value = undefined

    try {
      const course = await getCourse(http, courseId)
      values.value = {
        name: course.name,
        description: course.description ?? '',
        learningType: course.learningType,
        status: course.status,
      }
    } catch (caught) {
      error.value = reasonOf(caught, 'course-load-failed')
    } finally {
      loading.value = false
    }
  }

  const save = async (): Promise<boolean> => {
    const school = schoolId.value
    if (saving.value || !school) return false

    saving.value = true
    error.value = undefined

    try {
      if (courseId) await updateCourse(http, courseId, values.value)
      else await createCourse(http, school, values.value)
      return true
    } catch (caught) {
      error.value = reasonOf(caught, 'course-save-failed')
      return false
    } finally {
      saving.value = false
    }
  }

  return { values, loading, saving, error, load, save }
}
