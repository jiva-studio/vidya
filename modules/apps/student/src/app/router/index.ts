import './types'

import { createRouter, createWebHistory } from 'vue-router'

import { sectionRoutes } from '../sections'
import { requireSchoolCode, requireSession, skipLoginWhenSignedIn } from './guards'

export const createAppRouter = () => {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: sectionRoutes(),
  })

  router.beforeEach(skipLoginWhenSignedIn)
  router.beforeEach(requireSchoolCode)
  router.beforeEach(requireSession)

  return router
}
