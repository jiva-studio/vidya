import { setup } from '@storybook/vue3-vite'
import type { LessonId, PermissionKey } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSession } from '@/shared/session'
import { LessonEditorView } from '@/widgets/lesson-editor'

const LESSON = asId<LessonId>('l1')

// The editor holds a route guard for unsaved changes, so it has to be shown
// where it really lives: as a matched route rather than a bare component.
const Editor = defineComponent({
  name: 'EditorStory',
  setup: () => () => h(LessonEditorView, { lessonId: LESSON }),
})

const blank = { template: '<div />' }

export const installStoryRouter = (): void => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lesson-editor', component: Editor },
      { path: '/lessons', name: 'lessons', component: blank },
    ],
  })

  void router.push('/')

  setup((app) => {
    app.use(router)
  })
}

/** A session with exactly the rights a story wants to show the screen under. */
export const signInWith = (permissions: PermissionKey[]): void => {
  const claims = {
    sub: 'u1',
    exp: 2_000_000_000,
    permissions: [{ sid: 'school-1', p: permissions }],
  }
  useSession().start({ accessToken: `h.${btoa(JSON.stringify(claims))}.s`, refreshToken: 'r' })
}
