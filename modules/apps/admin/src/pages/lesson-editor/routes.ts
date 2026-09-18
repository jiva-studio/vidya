import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes for the lesson editor. Owned by T5.
 *
 * The lessons list links here by name, so the address may change without
 * touching another section. The course stays in the path because the editor is
 * reached from inside a course and leaves back into it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/courses/:courseId/lessons/:lessonId/editor',
    name: 'lesson-editor',
    component: () => import('./ui/LessonEditorPage.vue'),
    meta: {
      permission: 'lessons:update',
      breadcrumbs: ['nav-courses', 'lessons-title', 'editor-title'],
    },
  },
]
