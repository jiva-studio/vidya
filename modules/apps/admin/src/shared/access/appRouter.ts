import { type ShallowRef, shallowRef } from 'vue'
import type { Router } from 'vue-router'

const router = shallowRef<Router>()

/**
 * The router the application runs on.
 *
 * The school lives in the address, so everything that needs to know it needs
 * the router — including the parts that run outside a component, where
 * `useRouter()` has nothing to inject from.
 */
export const appRouter = (): ShallowRef<Router | undefined> => router

export const setAppRouter = (value: Router | undefined): void => {
  router.value = value
}
