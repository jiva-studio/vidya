import type { SchoolId } from '@vidya/domain'
import type { GetSchoolsResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

/**
 * Names for the schools the token grants.
 *
 * The token carries ids and nothing else, and reading the school list needs
 * `schools:read`, which a teacher does not have. A missing name is therefore
 * ordinary rather than an error, and the switcher falls back to the id.
 */
export const loadSchoolNames = async (http: HttpClient): Promise<Map<SchoolId, string>> => {
  try {
    const response = await http.get<GetSchoolsResponse>(Routes().edu.schools.find())
    return new Map(response.items.map((school) => [school.id, school.name]))
    // Refused or unreachable: the switcher still works, it just shows ids.
  } catch {
    return new Map()
  }
}
