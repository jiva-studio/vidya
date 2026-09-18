import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { useSession } from '@/app'
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

router.beforeEach((to) => {
  const { session } = useSession()
  if (!session.value && to.name !== 'signin') return { name: 'signin' }
})

export default router
