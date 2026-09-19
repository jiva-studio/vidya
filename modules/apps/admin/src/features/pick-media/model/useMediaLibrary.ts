import { ref } from 'vue'

import type { MediaKind, MediaRecord } from '@/entities/media'
import { MediaError, useMediaGateway } from '@/entities/media'

/**
 * The library as a screen reads it: one page, one search term, one failure.
 *
 * Paging and searching go through the same call, so a term typed on page three
 * cannot leave the listing showing page three of a different set.
 */
export const useMediaLibrary = (kind: MediaKind) => {
  const gateway = useMediaGateway()

  const items = ref<MediaRecord[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(1)
  const term = ref('')
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const open = async (next = 1): Promise<void> => {
    loading.value = true
    error.value = undefined

    try {
      const answer = await gateway.list({ kind, term: term.value, page: next })
      items.value = answer.items
      total.value = answer.total
      page.value = answer.page
      pageSize.value = answer.pageSize
    } catch (failure) {
      error.value = failure instanceof MediaError ? failure.reason : 'state-error'
      items.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  const search = async (next: string): Promise<void> => {
    term.value = next
    await open(1)
  }

  return { items, total, page, pageSize, term, loading, error, open, search }
}
