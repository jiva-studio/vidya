import type { SchoolId } from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'

import { useSession } from '../session'
import { appRouter } from './appRouter'

/**
 * Which school the operator is working in.
 *
 * The school is the first segment of the address, not session state: a link
 * opens the school it was written in, two schools open in two tabs, and the
 * back button restores the tenant along with the screen. The list of schools
 * still comes from the token, so it cannot disagree with what the server will
 * allow, and an address naming a school the token does not grant is corrected
 * by the router guard.
 */
export const useCurrentSchool = createGlobalState(() => {
  const { schoolIds } = useSession()
  const router = appRouter()

  const inAddress = computed<SchoolId | undefined>(() =>
    schoolOf(router.value?.currentRoute.value.params.schoolId),
  )

  const schoolId = computed<SchoolId | undefined>(() =>
    inAddress.value && schoolIds.value.includes(inAddress.value)
      ? inAddress.value
      : schoolIds.value[0],
  )

  const hasChoice = computed(() => schoolIds.value.length > 1)

  // Every list on screen belongs to the school it was loaded for. Bumping this
  // is how a screen learns its data is stale without each of them subscribing
  // to the school itself.
  const generation = ref(0)
  watch(schoolId, () => {
    generation.value += 1
  })

  const select = (id: SchoolId) => {
    const target = router.value
    if (!target || !schoolIds.value.includes(id)) return
    void target.push(sameScreenIn(target.currentRoute.value, id))
  }

  return { schoolId, schoolIds, hasChoice, generation, select }
})

const schoolOf = (raw: string | string[] | undefined): SchoolId | undefined =>
  (Array.isArray(raw) ? raw[0] : raw) as SchoolId | undefined

/**
 * Where a switch of school lands: the screen the operator is on.
 *
 * A screen addressed by an identifier shows one record of one school — one
 * course, one role, one lesson — and that record is not in the school being
 * moved to, so its section's index is where the work continues.
 */
const sameScreenIn = (
  from: RouteLocationNormalizedLoaded,
  schoolId: SchoolId,
): RouteLocationRaw => {
  const record = Object.keys(from.params).some((key) => key !== 'schoolId')
  if (record) return { name: from.meta.section ?? 'dashboard', params: { schoolId } }

  return {
    name: from.name ?? 'dashboard',
    params: { ...from.params, schoolId },
    query: from.query,
    hash: from.hash,
  }
}
