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
    path: '/s/:schoolId/courses/:courseId/lessons/:lessonId/editor',
    name: 'lesson-editor',
    component: () => import('./ui/LessonEditorPage.vue'),
    meta: {
      section: 'courses',
      permission: 'lessons:update',
      nav: { parent: 'lessons', label: 'editor-title' },
    },
  },
  {
    // One version, read-only. A reviewer reaches it from a piece of work
    // answered against a version that has since been replaced, and reading a
    // published version is `lessons:read` work rather than editing.
    path: '/s/:schoolId/lessons/:lessonId/versions/:versionId',
    name: 'lesson-version',
    component: () => import('./ui/LessonVersionPage.vue'),
    meta: {
      section: 'courses',
      permission: 'lessons:read',
      nav: { parent: 'courses', label: 'version-title' },
    },
  },
]
