import type { SchoolId } from '@vidya/domain'
import { computed, ref } from 'vue'

import { useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'

import { loadSchoolNames } from '../api'
import type { SchoolOption } from '../types'

// Names are a decoration shared by every switcher on screen, and they do not
// change while a tab is open. A stale entry cannot mislead: the list is built
// from the token, so a name is only ever shown for a school it belongs to.
const names = ref(new Map<SchoolId, string>())
let loading: Promise<void> | undefined

/** Drops the cached names. Tests and stories start from nothing. */
export const resetSchoolNames = (): void => {
  names.value = new Map()
  loading = undefined
}

/**
 * The schools offered in the switcher, and the act of moving between them.
 *
 * The list comes from the token rather than from the server, so it cannot
 * offer a school the next request will refuse. Reading the school list needs
 * `schools:read`, which a teacher does not have, so a missing name is ordinary
 * and the switcher falls back to the id.
 */
export const useSchoolOptions = () => {
  const http = useHttp()
  const school = useCurrentSchool()

  const options = computed<SchoolOption[]>(() =>
    school.schoolIds.value.map((id) => ({ id, name: names.value.get(id) ?? '' })),
  )

  const load = (): Promise<void> => {
    if (school.schoolIds.value.length === 0) return Promise.resolve()

    loading ??= loadSchoolNames(http).then((loaded) => {
      names.value = loaded
    })

    return loading
  }

  return {
    options,
    load,
    select: school.select,
    hasChoice: school.hasChoice,
    current: school.schoolId,
  }
}
