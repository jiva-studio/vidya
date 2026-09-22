import type { LocalCourse, LocalSchool } from '@vidya/client'
import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import { keepPublished } from './keepPublished'

interface Catalogue {
  readonly school: LocalSchool | null
  readonly courses: readonly LocalCourse[]
}

const NOTHING: Catalogue = { school: null, courses: [] }

/**
 * What one school teaches, read by the code its address carries.
 *
 * The code is resolved against the local database rather than the server: the
 * schools on this machine are the ones this student joined, and a code that
 * names none of them is a school whose rows have not arrived — which the
 * screen says, instead of claiming the school does not exist.
 */
export const useSchoolCatalogue = (code: () => string) => {
  const schools = useLocalSchools()
  const education = useLocalEducation()

  const { data, reading } = useLocalRead(
    async (): Promise<Catalogue> => {
      const school = await schools.getByCode(code())
      if (school === null) return NOTHING

      return { school, courses: keepPublished(await education.courses.list(), school.id) }
    },
    NOTHING,
    [code],
  )

  return {
    school: computed(() => data.value.school),
    courses: computed(() => data.value.courses),
    reading,
  }
}
