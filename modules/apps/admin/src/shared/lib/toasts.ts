import type { ToastItem } from '@vidya/ui'
import { inject, type InjectionKey, ref } from 'vue'

/**
 * One place a screen's outcomes are announced from.
 *
 * A component deep in a document cannot render its own stack: two of them
 * uploading would put two stacks in two corners. It announces here, and the
 * page that owns the screen renders the one `Toaster`.
 */
export const createToasts = () => {
  const items = ref<ToastItem[]>([])
  let last = 0

  const show = (toast: Omit<ToastItem, 'id'>): void => {
    last += 1
    items.value = [...items.value, { ...toast, id: String(last) }]
  }

  const dismiss = (id: string): void => {
    items.value = items.value.filter((held) => held.id !== id)
  }

  return { items, show, dismiss }
}

export type Toasts = ReturnType<typeof createToasts>

export const toastsKey: InjectionKey<Toasts> = Symbol('vidya.toasts')

/** Announcing is optional: a component under test or in a story may have nowhere to say it. */
export const useToasts = (): Toasts => inject(toastsKey, null) ?? createToasts()
