import type { SchoolId } from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useApi } from '@/shared/api'

import { loadSchoolNames } from '../api'
import type { SchoolOption } from '../types'

/**
 * The schools offered in the switcher, and the act of moving between them.
 *
 * The list comes from the token rather than from the server, so it cannot
 * promise a school the next request will refuse. Names are a decoration
 * fetched once; without them the switcher shows ids and still works.
 */
export const useSchoolOptions = createGlobalState(() => {
  const school = useCurrentSchool()
  const names = ref(new Map<SchoolId, string>())
  let loaded = false

  const options = computed<SchoolOption[]>(() =>
    school.schoolIds.value.map((id) => ({ id, name: names.value.get(id) ?? '' })),
  )

  const load = async () => {
    if (loaded || school.schoolIds.value.length === 0) return
    loaded = true
    names.value = await loadSchoolNames(useApi())
  }

  // A sign-out drops the names with the session; the next sign-in may be
  // someone else, whose schools these are not.
  watch(
    () => school.schoolIds.value.length,
    (count) => {
      if (count !== 0) return
      loaded = false
      names.value = new Map()
    },
  )

  return {
    options,
    load,
    select: school.select,
    hasChoice: school.hasChoice,
    current: school.schoolId,
  }
})
