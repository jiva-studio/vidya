import type { SchoolId } from '@vidya/domain'
import type {
  NavigationGuardWithThis,
  RouteLocationNormalized,
  Router,
  RouteRecordNormalized,
} from 'vue-router'

import { grants, useSession } from '@/shared/session'

/** The segment every school-scoped address starts with. */
const SCHOOL_SEGMENT = ':schoolId'

/**
 * The only business rule allowed in a guard: whether there is a session at all.
 *
 * Where the visitor was going is carried along, school segment included, so
 * signing in returns them to the screen they asked for rather than to the root.
 * A permission the school does not grant lands on the refusal screen instead of
 * a blank one.
 */
export const requireSession: NavigationGuardWithThis<undefined> = (to) => {
  const { isSignedIn, permissions, schoolIds } = useSession()

  if (to.meta.public) return true

  if (!isSignedIn.value) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  const needed = to.meta.permission
  if (!needed) return true

  // The school the visitor ends up in: an address naming one the token does not
  // grant is about to be sent to the first granted school anyway.
  const wanted = schoolIn(to)
  const schoolId = wanted && schoolIds.value.includes(wanted) ? wanted : schoolIds.value[0]

  return grants(permissions.value, schoolId, needed) ? true : { name: 'forbidden' }
}

/**
 * Puts the school the visitor is allowed to work in into the address.
 *
 * An address without the segment, with an unknown school or with one the token
 * does not grant opens the same screen under the first granted school. A token
 * granting nothing has nowhere to be sent, so it is refused outright rather
 * than bounced between two addresses.
 */
export const resolveSchool =
  (router: Router): NavigationGuardWithThis<undefined> =>
  (to) => {
    const { isSignedIn, schoolIds } = useSession()

    if (!isSignedIn.value) return true

    const granted = schoolIds.value
    if (granted.length === 0) return refusable(to) ? { name: 'forbidden' } : true

    const wanted = schoolIn(to)
    if (wanted === undefined) return underSchool(router, to, granted[0])
    if (granted.includes(wanted)) return true

    return {
      name: to.name,
      params: { ...to.params, schoolId: granted[0] },
      query: to.query,
      hash: to.hash,
    }
  }

/** A signed-in operator has no business on the sign-in screen. */
export const skipLoginWhenSignedIn: NavigationGuardWithThis<undefined> = (to) => {
  if (to.name !== 'login') return true
  return useSession().isSignedIn.value ? { path: '/' } : true
}

const schoolIn = (to: RouteLocationNormalized): SchoolId | undefined => {
  const raw = to.params.schoolId
  return (Array.isArray(raw) ? raw[0] : raw) as SchoolId | undefined
}

const isSchoolScoped = (record: RouteRecordNormalized): boolean =>
  record.path.includes(SCHOOL_SEGMENT)

// Sign-in, the refusal itself and an address no section owns are not refused:
// only a screen that would need a school the token does not have.
const refusable = (to: RouteLocationNormalized): boolean =>
  !to.meta.public && to.name !== 'forbidden'

// An address written before the school was in it — the root, or a link pasted
// from an older build — names a screen that exists under a school. Anything
// else, such as the sign-in screen or an address no section owns, does not.
const underSchool = (router: Router, to: RouteLocationNormalized, schoolId: SchoolId) => {
  const path = `/s/${schoolId}${to.fullPath === '/' ? '' : to.fullPath}`
  return router.resolve(path).matched.some(isSchoolScoped) ? path : true
}
