<script setup lang="ts">
import { Button, Input } from '@vidya/ui'

import { answerRowClasses } from './styles'
import type { QuizAnswerRowEmits, QuizAnswerRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizAnswerRowProps>(), { frozen: false, right: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizAnswerRowEmits>()

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
</script>

<template>
  <div :class="answerRowClasses">
    <input
      type="radio"
      :name="props.name"
      :checked="props.right"
      :disabled="props.frozen"
      :aria-label="$t('editor-quiz-right-answer')"
      @change="onRight"
    />
    <Input
      :model-value="props.text"
      :readonly="props.frozen"
      :aria-label="$t('editor-quiz-answer-label', { number: props.index + 1 })"
      @update:model-value="onText"
    />
    <Button v-if="!props.frozen" size="sm" variant="ghost" @click="onRemove">
      {{ $t('editor-quiz-answer-remove') }}
    </Button>
  </div>
</template>
