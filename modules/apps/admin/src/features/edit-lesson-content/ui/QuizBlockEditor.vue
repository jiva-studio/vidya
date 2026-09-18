<script setup lang="ts">
import { Button, FormField, Input } from '@vidya/ui'
import { computed } from 'vue'

import { addAnswer, removeAnswer, setAnswer, setQuestion, setRightAnswer } from '../model'
import QuizAnswerRow from './QuizAnswerRow.vue'
import { fieldStackClasses } from './styles'
import type { QuizBlockEditorEmits, QuizBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const answers = computed(() => props.block.answers)
const group = computed(() => `quiz-${props.block.id}`)

/* -------------------------------- Handlers -------------------------------- */

function onQuestion(question: string) {
  emit('update', setQuestion(props.block, question))
}

function onAnswerText(index: number, text: string) {
  emit('update', setAnswer(props.block, index, text))
}

function onRight(index: number) {
  emit('update', setRightAnswer(props.block, index))
}

function onRemoveAnswer(index: number) {
  emit('update', removeAnswer(props.block, index))
}

function onAddAnswer() {
  emit('update', addAnswer(props.block))
}
</script>

<template>
  <div :class="fieldStackClasses">
    <FormField :label="$t('editor-quiz-question-label')">
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.block.question"
          :described-by="field.describedBy"
          :readonly="props.frozen"
          @update:model-value="onQuestion"
        />
      </template>
    </FormField>
    <FormField :label="$t('editor-quiz-answers-label')" :hint="$t('editor-quiz-answers-hint')">
      <template #default>
        <QuizAnswerRow
          v-for="(answer, index) in answers"
          :key="`${group}-${index}`"
          :name="group"
          :index="index"
          :text="answer"
          :right="index === props.block.rightAnswer"
          :frozen="props.frozen"
          @text="onAnswerText"
          @right="onRight"
          @remove="onRemoveAnswer"
        />
      </template>
    </FormField>
    <Button v-if="!props.frozen" size="sm" variant="secondary" @click="onAddAnswer">
      {{ $t('editor-quiz-answer-add') }}
    </Button>
  </div>
</template>
