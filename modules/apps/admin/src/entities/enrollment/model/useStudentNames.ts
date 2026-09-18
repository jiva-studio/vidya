import type { UserId } from '@vidya/domain'
import { ref } from 'vue'

import type { NameLookup, StudentNames } from './types'

/**
 * Names for the people a list refers to, read once each.
 *
 * Neither `EnrollmentSummary` nor `HomeworkSummary` carries a name, and no
 * endpoint takes a set of identifiers, so the best the wire allows is one
 * request per person the page has never seen. Identifiers already asked for are
 * never asked again — a queue of thirty works by five students costs five
 * requests, not thirty — and the batch goes out at once rather than row by row.
 *
 * A name that cannot be read is not an error: `users:read` is a separate right,
 * and a reviewer without it still has work to do.
 */
export const useStudentNames = (lookup: NameLookup): StudentNames => {
  const names = ref(new Map<UserId, string>())
  const asked = new Set<UserId>()

  const read = async (id: UserId): Promise<void> => {
    try {
      const name = await lookup(id)
      if (name) names.value.set(id, name)
    } catch {
      // The screen shows the identifier instead; a missing name loses nothing else.
      asked.add(id)
    }
  }

  const resolve = async (ids: (UserId | undefined)[]): Promise<void> => {
    const wanted = [...new Set(ids)].filter((id): id is UserId => !!id && !asked.has(id))
    if (wanted.length === 0) return

    wanted.forEach((id) => asked.add(id))
    await Promise.all(wanted.map(read))
    names.value = new Map(names.value)
  }

  return { names, resolve }
}
