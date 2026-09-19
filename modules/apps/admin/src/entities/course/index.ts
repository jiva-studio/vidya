// Public API of the course entity. Owned by T3.
//
// Requests live in `api/`, the view model in `model/`. Nothing outside this
// slice reaches past this file.
export { createCourse, getCourse, getCourses, updateCourse } from './api'
export { useCourseForm, useCourses } from './model'
export type * from './types'
