import type { GroupId } from '@vidya/domain'

/**
 * A group as both screens draw it: a name and what it says about itself.
 *
 * No date. A group still taking students has none — it is stamped when
 * recruitment closes — so a card that printed one would print either an empty
 * line or a date meaning the opposite of what a student reads into it.
 */
export interface GroupSummary {
  readonly id: GroupId
  readonly name: string
  readonly description: string | null
}

export interface GroupsListProps {
  items: readonly GroupSummary[]

  /** Whether each row carries a radio; the catalogue lists without choosing. */
  selectable?: boolean
}

export interface GroupsListItemProps {
  value: GroupId
  name: string
  description?: string | null
  selectable?: boolean
}
