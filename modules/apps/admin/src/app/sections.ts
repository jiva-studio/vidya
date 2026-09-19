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
import type { MenuGroup, MenuItem } from '@/shared/navigation'

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

/**
 * The sidebar, with one heading per group however many sections declare it.
 *
 * Courses and groups are both `edu`, requests and homework are both `process`:
 * each section declares its own entry under the heading it belongs to, and the
 * headings are merged here, in the order they were first declared. Without the
 * merge a section had to either draw its heading a second time or hand its
 * entry to a neighbour, and both are worse than eight lines of gathering.
 */
export const sectionMenu = (): MenuGroup[] => {
  const merged = new Map<string, MenuItem[]>()

  for (const section of sections) {
    for (const group of section.menu ?? []) {
      const items = merged.get(group.label) ?? []
      merged.set(group.label, [...items, ...group.items])
    }
  }

  return [...merged].map(([label, items]) => ({ label, items }))
}

export const installSectionMessages = (): void => {
  addMessages(authMessages)
  for (const section of sections) {
    if (section.messages) addMessages(section.messages)
  }
}
