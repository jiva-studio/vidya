import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { useConnections, useSyncStatus } from '@/app'
import { routes as authRoutes } from '@/ui/auth/routes'
import { routes as educationRoutes } from '@/ui/education/routes'
import { routes as settingsRoutes } from '@/ui/settings/routes'

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/education/courses' },
  ...authRoutes,
  ...educationRoutes,
  ...settingsRoutes,
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * A connection, not a session: the screens read the device, and the device is
 * keyed by the identity a connection carries. A stored session with no
 * connection behind it — an app upgraded from the build that had only one
 * server — would otherwise be let through to screens with no owner to read for.
 *
 * A connection whose token the server has stopped accepting is **not** sent
 * here: what is on the device stays readable whatever any server thinks of a
 * token, and a student with three schools must not be thrown out of the two
 * that still work. The exception is the one case where there is nothing to
 * stay for — every school waiting for a sign-in and nothing ever downloaded —
 * because an empty list with no way back in is a dead application.
 */
router.beforeEach((to) => {
  if (to.name === 'signin') return true

  const { connections, awaitingSignIn } = useConnections()
  if (connections.value.length === 0) return { name: 'signin' }

  const everySchoolWaiting = awaitingSignIn.value.length === connections.value.length
  if (everySchoolWaiting && !useSyncStatus().firstRunCompleted.value) return { name: 'signin' }
})

export default router
