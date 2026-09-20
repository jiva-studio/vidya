import type { Ref } from 'vue'
import { nextTick, onMounted } from 'vue'

const Steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }

/**
 * Up and down walk a menu, which is how a menu opened from the keyboard is used.
 *
 * The first item takes focus as the menu appears: it was opened by a keystroke
 * as often as by a click, and a menu nothing is focused in answers to neither
 * the arrows nor Enter.
 */
export const useMenuKeys = (root: Ref<HTMLElement | null>) => {
  onMounted(() => void nextTick(() => items()[0]?.focus()))

  function items(): HTMLElement[] {
    return [...(root.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
  }

  function onKey(event: KeyboardEvent) {
    const delta = Steps[event.key]
    if (!delta) return

    const open = items()
    if (open.length === 0) return

    event.preventDefault()
    const at = open.findIndex((item) => item === document.activeElement)
    open[(at + delta + open.length) % open.length]?.focus()
  }

  return { onKey }
}
