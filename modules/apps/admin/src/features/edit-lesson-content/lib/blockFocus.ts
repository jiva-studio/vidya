import type { MoveDirection } from '../types'

const FieldSelector = '.cm-content, textarea, input[type="text"]'

// The lesson is walked through the DOM rather than through the content tree: up
// and down cross options, blocks and sections alike, and the order they follow
// is the order the fields are laid out in, which is the only place that order
// is written down.
export function stepToNeighbourField(from: HTMLElement, delta: MoveDirection): boolean {
  const scope = from.closest<HTMLElement>('[data-lesson-document]')
  if (!scope) return false

  const fields = [...scope.querySelectorAll<HTMLElement>(FieldSelector)]
  const at = fields.findIndex((field) => field === from || field.contains(from))
  const next = at < 0 ? undefined : fields[at + delta]
  if (!next) return false

  next.focus()
  if (delta < 0) toEnd(next)
  return true
}

export function atFieldEdge(target: EventTarget | null, delta: MoveDirection): boolean {
  if (target instanceof HTMLInputElement) return true
  if (!(target instanceof HTMLTextAreaElement)) return false

  const at = target.selectionStart ?? 0
  if (at !== (target.selectionEnd ?? at)) return false

  return delta < 0 ? target.value.lastIndexOf('\n', at - 1) < 0 : target.value.indexOf('\n', at) < 0
}

function toEnd(field: HTMLElement) {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const at = field.value.length
    return field.setSelectionRange(at, at)
  }

  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(field)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}
