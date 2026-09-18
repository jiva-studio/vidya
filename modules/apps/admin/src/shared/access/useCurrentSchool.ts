import type { SchoolId } from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useSession } from '../session'

/**
 * Which school the operator is working in.
 *
 * The school is session state, not a route parameter: addresses stay short and
 * a link sent to a colleague opens the same screen in whichever school they
 * belong to. The list comes from the token, so it cannot disagree with what the
 * server will allow.
 */
export const useCurrentSchool = createGlobalState(() => {
  const { schoolIds } = useSession()

  const selected = ref<SchoolId | undefined>(undefined)

  const schoolId = computed<SchoolId | undefined>(() =>
    selected.value && schoolIds.value.includes(selected.value)
      ? selected.value
      : schoolIds.value[0],
  )

  const hasChoice = computed(() => schoolIds.value.length > 1)

  // A new token is a new set of grants, and possibly a different person. The
  // school picked under the old one is not theirs to inherit.
  watch(
    () => schoolIds.value.join(','),
    () => {
      selected.value = undefined
    },
    // Synchronously, so that signing in and then choosing a school in the same
    // tick leaves the choice standing rather than having it wiped a tick later.
    { flush: 'sync' },
  )

  // Every list on screen belongs to the school it was loaded for. Bumping this
  // is how a screen learns its data is stale without each of them subscribing
  // to the school itself.
  const generation = ref(0)
  watch(schoolId, () => {
    generation.value += 1
  })

  const select = (id: SchoolId) => {
    if (!schoolIds.value.includes(id)) return
    selected.value = id
  }

  return { schoolId, schoolIds, hasChoice, generation, select }
})
