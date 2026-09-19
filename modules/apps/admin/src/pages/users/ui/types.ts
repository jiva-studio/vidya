import type { UserId } from '@vidya/domain'
import type { UserDetails } from '@vidya/protocol'

import type { UserRow } from '@/entities/user'

export interface UsersTableRowProps {
  user: UserRow
}

export interface UsersTableRowEmits {
  open: [id: UserId]
}

export interface UserCardPageProps {
  id: UserId
}

export interface UserDetailsFormProps {
  user: UserDetails
}

export interface UserFactsProps {
  user: UserDetails
}

export interface UserSchoolsListProps {
  userId: UserId
}
