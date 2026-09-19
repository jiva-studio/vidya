import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { useConnections } from '@/app'
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

// A connection, not a session: the screens read the device, and the device is
// keyed by the identity a connection carries. A stored session with no
// connection behind it — an app upgraded from the build that had only one
// server — would otherwise be let through to screens with no owner to read for.
router.beforeEach((to) => {
  const { connections } = useConnections()
  if (connections.value.length === 0 && to.name !== 'signin') return { name: 'signin' }
})

export default router
