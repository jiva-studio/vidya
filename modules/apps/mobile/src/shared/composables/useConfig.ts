import { createGlobalState } from '@vueuse/core'
import { ref } from 'vue'

/**
 * What the sign-in wizard carries between its two steps.
 *
 * Tokens are not here: they belong to the session, which is persisted and
 * cleared as one thing.
 */
export const useConfig = createGlobalState(() => {
  const email = ref('')
  return { email }
})
