import './types'

import { createRouter, createWebHistory } from 'vue-router'

import { setAppRouter } from '@/shared/access'

import { sectionRoutes } from '../sections'
import { requireSession, resolveSchool, skipLoginWhenSignedIn } from './guards'

export const createAppRouter = () => {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: sectionRoutes(),
  })

  // The school is read from this router's address, by screens and by the parts
  // that run outside one.
  setAppRouter(router)

  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSession)
  router.beforeEach(resolveSchool(router))

  return router
}
