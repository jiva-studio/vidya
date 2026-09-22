import { computed } from 'vue'

import { useLocalEducation, useLocalRead, useLocalSchools } from '@/shared/data'

import type { SchoolRow } from '../types'
import { toSchoolRows } from './toSchoolRows'

/**
 * Which schools this student is in, read from the synchronised collection.
 *
 * Not from `GET /edu/users/:id/schools`: the server counts membership there by
 * roles alone, while the lists this site is drawn from also carry the schools
 * of accepted places. Asking would give a shorter list than the student can
 * see, and the settings screen would disagree with their own learning.
 */
export const useMySchools = () => {
  const schools = useLocalSchools()
  const { enrollments } = useLocalEducation()

  const { data, reading } = useLocalRead(async (): Promise<SchoolRow[]> => {
    const [held, places] = await Promise.all([schools.list(), enrollments.list()])

    return toSchoolRows(held, places)
  }, [])

  return { rows: computed(() => data.value), reading }
}
