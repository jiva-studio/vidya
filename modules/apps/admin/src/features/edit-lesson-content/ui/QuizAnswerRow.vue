<script setup lang="ts">
import { Input } from '@vidya/ui'
import type { ComponentPublicInstance } from 'vue'
import { ref } from 'vue'

import type { MoveDirection } from '../types'
import { answerRowClasses, answerTextClasses } from './styles'
import type { AnswerCaret, QuizAnswerRowEmits, QuizAnswerRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizAnswerRowProps>(), { frozen: false, right: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizAnswerRowEmits>()

/* --------------------------------- State ---------------------------------- */

const field = ref<ComponentPublicInstance | null>(null)

/* -------------------------------- Handlers -------------------------------- */

function onText(text: string) {
  emit('text', props.index, text)
}

function onRight() {
  emit('right', props.index)
}

function onKey(event: KeyboardEvent) {
  if (event.altKey) return onReorderKey(event)
  if (event.key === 'Enter') return take(event, () => emit('split', props.index))
  // An option still carrying text is being edited, not dismissed.
  if (event.key === 'Backspace' && !props.text)
    return take(event, () => emit('collapse', props.index))

  // Up and down walk the quiz the way they walk any list of lines, so the
  // author reaches the question above and the next option below without
  // leaving the keyboard.
  if (event.key === 'ArrowUp') return take(event, () => emit('step', props.index, -1))
  if (event.key === 'ArrowDown') return take(event, () => emit('step', props.index, 1))
}

/* -------------------------------- Helpers --------------------------------- */

function onReorderKey(event: KeyboardEvent) {
  const delta = reorderDelta(event.key)
  if (delta) take(event, () => emit('move', props.index, delta))
}

function reorderDelta(key: string): MoveDirection | undefined {
  if (key === 'ArrowUp') return -1
  if (key === 'ArrowDown') return 1
  return undefined
}

function take(event: KeyboardEvent, act: () => void) {
  event.preventDefault()
  act()
}

/** The list owns focus: it alone knows which row a change left the author in. */
function focus(caret: AnswerCaret = 'end') {
  const element = field.value?.$el
  if (!(element instanceof HTMLInputElement)) return

  element.focus()
  const at = caret === 'end' ? element.value.length : 0
  element.setSelectionRange(at, at)
}

defineExpose({ focus })
</script>

<template>
  <li :class="answerRowClasses" :data-answer-index="props.index">
    <input
      type="radio"
      :name="props.name"
      :checked="props.right"
      :disabled="props.frozen"
      :aria-label="$t('editor-quiz-right-answer', { number: props.index + 1 })"
      @change="onRight"
    />
    <Input
      ref="field"
      :class="answerTextClasses"
      :model-value="props.text"
      :readonly="props.frozen"
      :placeholder="$t('editor-quiz-answer-placeholder')"
      :aria-label="$t('editor-quiz-answer-label', { number: props.index + 1 })"
      @update:model-value="onText"
      @keydown="onKey"
    />
  </li>
</template>
