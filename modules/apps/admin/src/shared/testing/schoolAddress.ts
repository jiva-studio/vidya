import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { setAppRouter } from '../access'

const blank = { template: '<div />' }

/**
 * Puts a school in the address, the way the application addresses one.
 *
 * The school is read from the router, so anything that works in a school — or
 * moves between two — needs one. The screen is not the point here, so the
 * dashboard stands for all of them.
 */
export const addressSchool = async (schoolId: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/s/:schoolId', name: 'dashboard', component: blank }],
  })

  setAppRouter(router)
  await router.push({ name: 'dashboard', params: { schoolId } })
  return router
}
