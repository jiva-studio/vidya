import { useSortable } from '@vueuse/integrations/useSortable'
import type { Ref } from 'vue'

/**
 * Dragging, reported as a pair of positions and nothing else.
 *
 * SortableJS moves the nodes it was given as it drags; leaving that move in
 * place would put the DOM and the document out of step, so the move is undone
 * and the reorder is re-run through the model, which Vue then renders.
 */
export const useBlockSorting = (
  list: Ref<HTMLElement | null>,
  onReorder: (from: number, to: number) => void,
  handle: string,
): void => {
  useSortable(list, [], {
    handle,
    animation: 150,
    onUpdate: (event: { oldIndex?: number; newIndex?: number; from: HTMLElement }) => {
      const { oldIndex, newIndex } = event
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

      undo(event.from, oldIndex, newIndex)
      onReorder(oldIndex, newIndex)
    },
  })
}

/** Puts the dragged node back where it started, before the model re-renders. */
const undo = (parent: HTMLElement, from: number, to: number): void => {
  const nodes = [...parent.children]
  const dragged = nodes[to]
  if (!dragged) return

  parent.insertBefore(dragged, nodes[from > to ? from + 1 : from] ?? null)
}
