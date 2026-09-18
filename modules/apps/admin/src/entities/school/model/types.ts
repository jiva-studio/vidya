import type { SchoolId } from '@vidya/domain'
import type { SchoolSummary } from '@vidya/protocol'

/** One line of the schools table. The summary is already the whole of it. */
export type SchoolRow = SchoolSummary

/** What the school form edits. The schema holds a name and nothing else. */
export interface SchoolFormValues {
  name: string
}

/** What the settings form edits, held as the screen binds it. */
export interface SchoolConfigsValues {
  defaultStudentRoleId: string
  studentRoleIds: SchoolId[]
}
