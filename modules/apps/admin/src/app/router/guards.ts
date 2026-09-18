import type { NavigationGuardWithThis } from 'vue-router'

import { useCurrentSchool } from '@/shared/access'
import { grants, useSession } from '@/shared/session'

/**
 * The only business rule allowed in a guard: whether there is a session at all.
 *
 * Where the visitor was going is carried along, so signing in returns them to
 * the screen they asked for rather than to the root. A permission the current
 * school does not grant lands on the refusal screen instead of a blank one.
 */
export const requireSession: NavigationGuardWithThis<undefined> = (to) => {
  const { isSignedIn, permissions } = useSession()

  if (to.meta.public) return true

  if (!isSignedIn.value) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  const needed = to.meta.permission
  if (!needed) return true

  const { schoolId } = useCurrentSchool()
  if (grants(permissions.value, schoolId.value, needed)) return true

  return { name: 'forbidden' }
}

/** A signed-in operator has no business on the sign-in screen. */
export const skipLoginWhenSignedIn: NavigationGuardWithThis<undefined> = (to) => {
  if (to.name !== 'login') return true
  return useSession().isSignedIn.value ? { name: 'dashboard' } : true
}
