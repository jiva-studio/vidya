import type { HomeworkId } from '@vidya/domain'
import type { HomeworkDetails } from '@vidya/protocol'
import { ref } from 'vue'

import { reason, useHomeworkApi } from '@/entities/homework'

/**
 * The two decisions a reviewer makes about a piece of work.
 *
 * `ReviewHomeworkRequest` also carries a comment, and the server drops it:
 * there is no column for one and the controller never passes it on. Nothing
 * here sends it, and no screen asks for it — a field that silently loses what
 * was typed into it is worse than no field.
 *
 * Neither decision can be taken back. Accepted work is terminal, and returned
 * work only moves when the student submits again, so the return is confirmed
 * before it is sent rather than offered back afterwards.
 */
export const useGradeHomework = () => {
  const api = useHomeworkApi()

  const busy = ref(false)
  const error = ref<string | undefined>(undefined)

  const review = async (
    id: HomeworkId,
    status: 'accepted' | 'returned',
    grade?: number,
  ): Promise<HomeworkDetails | undefined> => {
    busy.value = true
    error.value = undefined

    try {
      return await api.review(id, { status, grade })
    } catch (failure) {
      error.value = reason(failure)
      return undefined
    } finally {
      busy.value = false
    }
  }

  const accept = (id: HomeworkId, grade: number) => review(id, 'accepted', grade)
  const returnForRevision = (id: HomeworkId) => review(id, 'returned')

  return { accept, returnForRevision, busy, error }
}
