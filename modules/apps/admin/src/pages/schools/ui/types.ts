import type { SchoolId } from '@vidya/domain'

import type { SchoolRow } from '@/entities/school'

export interface SchoolsTableRowProps {
  school: SchoolRow
  canUpdate: boolean
}

export interface SchoolsTableRowEmits {
  edit: [id: SchoolId]
  settings: [id: SchoolId]
}

/** Both the create and the edit screen are this component; the id tells them apart. */
export interface SchoolFormPageProps {
  id?: SchoolId
}

export interface SchoolSettingsPageProps {
  id: SchoolId
}
