import { isSchoolCode } from '@vidya/domain'
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router'

import { useConnection } from '@/shared/connection'

/**
 * The only rule allowed in a guard here: whether there is a connection at all.
 *
 * Where the visitor was going is carried along, so signing in returns them to
 * the address they asked for rather than to the root — a lesson, or a school's
 * joining page.
 */
export const requireSession: NavigationGuardWithThis<undefined> = (to) => {
  if (to.meta.public) return true
  if (useConnection().isSignedIn.value) return true

  return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
}

/** A signed-in student has no business on the sign-in screen. */
export const skipLoginWhenSignedIn: NavigationGuardWithThis<undefined> = (to) => {
  if (to.name !== 'login') return true
  return useConnection().isSignedIn.value ? { path: '/' } : true
}

/**
 * Keeps identifiers out of the address bar.
 *
 * A school is named by its public code — the one printed on the joining link —
 * and never by its identifier. Letting a UUID through would make both spellings
 * work, and the day one of them is the one people paste is the day the code
 * stops being the school's name.
 */
export const requireSchoolCode: NavigationGuardWithThis<undefined> = (to) => {
  const code = codeIn(to)
  if (code === undefined || isSchoolCode(code)) return true

  return { name: 'not-found', params: { pathMatch: to.path.slice(1).split('/') }, query: to.query }
}

const codeIn = (to: RouteLocationNormalized): string | undefined => {
  const raw = to.params.code
  const code = Array.isArray(raw) ? raw[0] : raw

  return code === undefined || code === '' ? undefined : code
}
