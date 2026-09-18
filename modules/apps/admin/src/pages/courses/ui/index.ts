// Screens of the courses section: composition only, no logic.
//
// This is the segment's barrel, not the slice's public API. The slice exports
// routes, menu and messages; a screen re-exported from `pages/courses/index.ts`
// would turn its lazy route into a static import.
export { default as CourseForm } from './CourseForm.vue'
export { default as CourseFormPage } from './CourseFormPage.vue'
export { default as CoursesPage } from './CoursesPage.vue'
export { default as CoursesTable } from './CoursesTable.vue'
