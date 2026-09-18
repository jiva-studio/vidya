import type { RoleId } from '@vidya/domain'

/**
 * The settings of a school, as `/edu/schools/:id/configs` answers them.
 *
 * `@vidya/protocol` carries no type for this resource — the API declares it in
 * its own DTOs only — so the wire shape is mirrored here and nowhere else.
 */
export interface SchoolConfigs {
  defaultStudentRoleId?: RoleId
  studentRoleIds: RoleId[]
}

/** Both fields are optional: the screen sends what the operator changed. */
export type UpdateSchoolConfigsRequest = Partial<SchoolConfigs>

/** Every write to the settings answers with this and nothing else. */
export interface UpdateSchoolConfigsResponse {
  success: boolean
}
