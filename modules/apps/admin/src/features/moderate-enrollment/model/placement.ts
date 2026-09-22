import type { GroupId } from '@vidya/domain'
import { isRecruiting } from '@vidya/domain'
import type { GroupSummary } from '@vidya/protocol'

import type { Placement, PlacementRequest } from '../types'

/**
 * What accepting from the row does about the group the student asked for.
 *
 * The row has no room to warn, so anything the review dialog would say out
 * loud sends the operator there instead. The server answers a wrong course
 * with a 409, which on the row path looks like a request that did nothing.
 */
export const decidePlacement = (request: PlacementRequest): Placement => {
  const wish = request.preferredGroupId
  if (!wish) return { kind: 'place' }

  // Nothing can be checked, so the wish goes as it is and the server decides.
  if (request.groupsUnreadable) return { kind: 'place', groupId: wish }

  const group = request.groups.get(wish)

  // The group has gone; the student waits in the queue, which is a real place.
  if (!group) return { kind: 'place' }

  if (group.courseId !== request.courseId) return { kind: 'review' }
  if (!isRecruiting(group.status)) return { kind: 'review' }

  return { kind: 'place', groupId: wish }
}

/** The groups a screen has read, keyed for {@link decidePlacement}. */
export const groupsById = (groups: readonly GroupSummary[]): Map<GroupId, GroupSummary> =>
  new Map(groups.map((group) => [group.id, group]))
