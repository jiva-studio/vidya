import type { HomeworkId } from '@vidya/domain'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import { useHomeworkApi } from '@/entities/homework'

/**
 * The works still awaiting review, seen from the one being read.
 *
 * Only what stands after the current work counts as left to do: the reviewer
 * walks the queue forward, and a figure that also counted what is behind would
 * never match what "Next" opens. A work decided here is struck out rather than
 * dropped, so the place the reviewer had reached in the queue survives the
 * decision. A queue that cannot be read leaves the screen with the work and
 * without a next one, which reads the same as having finished.
 */
export const useReviewQueue = (current: Ref<HomeworkId | undefined>) => {
  const api = useHomeworkApi()

  const ids = ref<HomeworkId[]>([])
  const decided = ref(new Set<HomeworkId>())

  const ahead = computed(() =>
    ids.value
      .slice(ids.value.indexOf(current.value as HomeworkId) + 1)
      .filter((id) => !decided.value.has(id)),
  )

  const next = computed<HomeworkId | undefined>(() => ahead.value[0])
  const remaining = computed(() => ahead.value.length)

  const load = async (): Promise<void> => {
    try {
      const response = await api.list({ status: 'pending' })
      ids.value = response.items.map((item) => item.id)
    } catch {
      ids.value = []
    }
  }

  const markDecided = (id: HomeworkId): void => {
    decided.value = new Set(decided.value).add(id)
  }

  return { next, remaining, load, markDecided }
}
