import type { LocalEnrollment, LocalSchool } from '@vidya/client'
import { isLive } from '@vidya/domain'

import type { SchoolRow } from '../types'

export const toSchoolRows = (
  schools: readonly LocalSchool[],
  enrollments: readonly LocalEnrollment[],
): SchoolRow[] =>
  schools.map((school) => ({
    school,
    places: enrollments.filter((place) => place.schoolId === school.id && isLive(place.status))
      .length,
  }))
