import type { HomeworkId } from '@vidya/domain'
import type { HomeworkDetails } from '@vidya/protocol'
import { ref } from 'vue'

import { reasonOf } from '@/shared/lib'

import { useHomeworkApi } from '../api'

/**
 * One piece of work, in full.
 *
 * The summary in the queue carries neither the answer nor the flag that says it
 * was written against a version since replaced, so opening a work is a request
 * of its own. It is also what a decision answers with, which is why the record
 * can be replaced without reading it again.
 */
export const useHomework = () => {
  const api = useHomeworkApi()

  const work = ref<HomeworkDetails | undefined>(undefined)
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const load = async (id: HomeworkId): Promise<void> => {
    loading.value = true
    error.value = undefined
    work.value = undefined

    try {
      work.value = await api.get(id)
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  const replace = (updated: HomeworkDetails): void => {
    work.value = updated
  }

  return { work, loading, error, load, replace }
}
