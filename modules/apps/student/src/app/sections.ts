import type { RouteRecordRaw } from 'vue-router'

import { messages as authMessages } from '@/features/auth-otp'
import * as homework from '@/pages/homework'
import * as join from '@/pages/join'
import * as learning from '@/pages/learning'
import * as login from '@/pages/login'
import * as notFound from '@/pages/not-found'
import * as school from '@/pages/school'
import * as settings from '@/pages/settings'
import { addMessages, type LocaleMessages } from '@/shared/i18n'

interface Section {
  routes?: RouteRecordRaw[]
  messages?: LocaleMessages
}

/**
 * Every section of the site, in the order their routes are registered.
 *
 * Sections declare themselves in their own `routes.ts` and `i18n/`, and are
 * gathered here — which is what keeps several people writing several sections
 * at once out of the same file.
 */
const sections: Section[] = [learning, homework, settings, school, join, login]

/** The catch-all comes after everything a section might own. */
const fallbacks: Section[] = [notFound]

export const sectionRoutes = (): RouteRecordRaw[] =>
  [...sections, ...fallbacks].flatMap((section) => section.routes ?? [])

export const installSectionMessages = (): void => {
  addMessages(authMessages)
  for (const section of sections) {
    if (section.messages) addMessages(section.messages)
  }
}
