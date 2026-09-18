import type { HomeworkId } from '@vidya/domain'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import { useStudentNames } from '@/entities/enrollment'
import type { HomeworkRow } from '@/entities/homework'
import { useHomework } from '@/entities/homework'
import { useUserApi } from '@/entities/user'

/**
 * Which work is open on the right, and how the reviewer moves between them.
 *
 * The queue carries summaries; the answer, the grade and the flag about the
 * version answered live on the work itself, so opening one is a request. The
 * selection survives the list being narrowed only if what it points at is still
 * there, which is why moving is done by position in the rows on screen.
 *
 * Who reviewed it is read the same way every other name on these screens is:
 * once per person, and never again (AC-41).
 */
export const useCurrentWork = (rows: Ref<HomeworkRow[]>) => {
  const details = useHomework()
  const users = useUserApi()
  const reviewers = useStudentNames(async (id) => (await users.get(id)).name)

  const selectedId = ref<HomeworkId | undefined>(undefined)

  const reviewerName = computed(() => {
    const by = details.work.value?.reviewedById
    return by ? reviewers.names.value.get(by) : undefined
  })

  const position = computed(() => rows.value.findIndex((row) => row.id === selectedId.value))

  const select = (id: HomeworkId | undefined): void => {
    selectedId.value = id
    if (id) void details.load(id)
  }

  const move = (step: number): void => {
    const at = position.value
    const next = at < 0 ? rows.value[0] : rows.value[at + step]
    if (next) select(next.id)
  }

  watch(details.work, (opened) => {
    if (opened?.reviewedById) void reviewers.resolve([opened.reviewedById])
  })

  return {
    selectedId,
    work: details.work,
    loading: details.loading,
    error: details.error,
    reviewerName,
    select,
    move,
  }
}
