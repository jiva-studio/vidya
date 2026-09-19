<script setup lang="ts">
import { IconButton, Input } from '@vidya/ui'
import { X } from 'lucide-vue-next'
import type { ComponentPublicInstance } from 'vue'
import { onMounted, ref } from 'vue'

import { answerActionsClasses, answerRowClasses, iconClasses } from './styles'
import type { QuizAnswerRowEmits, QuizAnswerRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizAnswerRowProps>(), {
  frozen: false,
  right: false,
  autofocus: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizAnswerRowEmits>()

/* --------------------------------- State ---------------------------------- */

const field = ref<ComponentPublicInstance | null>(null)

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  if (props.autofocus) focusField()
})

/* -------------------------------- Handlers -------------------------------- */

function onText(text: string) {
  emit('text', props.index, text)
}

function onRight() {
  emit('right', props.index)
}

function onRemove() {
  emit('remove', props.index)
}

/* -------------------------------- Helpers --------------------------------- */

function focusField() {
  const element = field.value?.$el
  if (element instanceof HTMLInputElement) element.focus()
}
</script>

<template>
  <li :class="answerRowClasses">
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
      :model-value="props.text"
      :readonly="props.frozen"
      :placeholder="$t('editor-quiz-answer-placeholder')"
      :aria-label="$t('editor-quiz-answer-label', { number: props.index + 1 })"
      @update:model-value="onText"
    />
    <span v-if="!props.frozen" :class="answerActionsClasses">
      <IconButton
        :label="$t('editor-quiz-answer-remove', { number: props.index + 1 })"
        variant="danger"
        @click="onRemove"
      >
        <X :class="iconClasses" />
      </IconButton>
    </span>
  </li>
</template>
