import type { RouteRecordRaw } from 'vue-router'

import { messages as authMessages } from '@/features/auth-otp'
import * as courses from '@/pages/courses'
import * as dashboard from '@/pages/dashboard'
import * as enrollments from '@/pages/enrollments'
import * as forbidden from '@/pages/forbidden'
import * as groups from '@/pages/groups'
import * as homeworkQueue from '@/pages/homework-queue'
import * as homeworkReview from '@/pages/homework-review'
import * as lessonEditor from '@/pages/lesson-editor'
import * as lessons from '@/pages/lessons'
import * as login from '@/pages/login'
import * as notFound from '@/pages/not-found'
import * as roles from '@/pages/roles'
import * as schools from '@/pages/schools'
import * as users from '@/pages/users'
import { addMessages, type LocaleMessages } from '@/shared/i18n'
import type { MenuGroup } from '@/shared/navigation'

interface Section {
  routes?: RouteRecordRaw[]
  menu?: MenuGroup[]
  messages?: LocaleMessages
}

/**
 * Every section of the admin, in the order their routes are registered.
 *
 * Sections declare themselves in their own `routes.ts`, `menu.ts` and `i18n/`,
 * and are gathered here. That is what keeps five people writing five sections
 * at once out of the same three files.
 */
const sections: Section[] = [
  login,
  dashboard,
  schools,
  roles,
  users,
  courses,
  lessons,
  groups,
  enrollments,
  homeworkQueue,
  homeworkReview,
  lessonEditor,
]

/** The refusal and the catch-all come after everything a section might own. */
const fallbacks: Section[] = [forbidden, notFound]

export const sectionRoutes = (): RouteRecordRaw[] =>
  [...sections, ...fallbacks].flatMap((section) => section.routes ?? [])

export const sectionMenu = (): MenuGroup[] => sections.flatMap((section) => section.menu ?? [])

export const installSectionMessages = (): void => {
  addMessages(authMessages)
  for (const section of sections) {
    if (section.messages) addMessages(section.messages)
  }
}
