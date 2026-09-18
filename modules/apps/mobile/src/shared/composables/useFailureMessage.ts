import { useFluent } from 'fluent-vue'
import { computed, type Ref } from 'vue'

import type { RemoteFailure } from './useRemoteData'

/**
 * Turns a failure kind into something a person can read.
 *
 * The wording is deliberately generic and lives in one place: the screen's own
 * title already says what failed to load, and a message per screen would be one
 * more string to translate for every language, five times over.
 */
export function useFailureMessage(failure: Ref<RemoteFailure | undefined>) {
  const fluent = useFluent()
  return computed(() => (failure.value ? fluent.$t(`error-${failure.value}`) : undefined))
}
