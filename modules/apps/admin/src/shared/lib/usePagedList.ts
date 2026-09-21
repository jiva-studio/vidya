import { computed, ref } from 'vue'

import { reasonOf } from './reasonOf'

/** As many rows as read at once without scrolling past the filters. */
export const PAGE_SIZE = 25

/** What a list endpoint answers: the page, and how many matched in all. */
export interface PagedAnswer<TRow> {
  items: TRow[]
  total: number
}

export interface PagedListOptions<TRow> {
  read: (page: { limit: number; offset: number }) => Promise<PagedAnswer<TRow>>
  fallback?: string
}

/**
 * One page of a list, and the state a screen needs around it.
 *
 * The page goes to the server rather than being sliced here: a school with
 * hundreds of rows would otherwise ship all of them to show twenty-five. A
 * late answer is dropped by its ticket, so switching page twice quickly cannot
 * leave the first answer on screen.
 */
export const usePagedList = <TRow>({ read, fallback }: PagedListOptions<TRow>) => {
  const rows = ref<TRow[]>([]) as { value: TRow[] }
  const total = ref(0)
  const page = ref(1)
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

  // Drawn only when there is a second page: a control that can do nothing is
  // one more thing to read past.
  const paged = computed(() => pages.value > 1)

  let ticket = 0

  const load = async (): Promise<void> => {
    const mine = ++ticket

    loading.value = true
    error.value = undefined
    rows.value = []

    try {
      const answer = await read({ limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE })
      if (mine !== ticket) return
      rows.value = answer.items
      total.value = answer.total ?? answer.items.length
    } catch (caught) {
      if (mine !== ticket) return
      error.value = reasonOf(caught, fallback)
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  const goTo = (next: number): void => {
    page.value = next
    void load()
  }

  /** Back to the first page: page four of the old result is not page four of the new. */
  const restart = (): void => {
    page.value = 1
    void load()
  }

  return { rows, total, page, pages, paged, loading, error, load, goTo, restart }
}
