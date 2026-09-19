<script setup lang="ts">
import { Button, FormField, Input } from '@vidya/ui'
import { computed, ref } from 'vue'

import { addAnswer, removeAnswer, setAnswer, setQuestion, setRightAnswer } from '../model'
import QuizAnswerRow from './QuizAnswerRow.vue'
import {
  answerListClasses,
  answersGroupClasses,
  fieldStackClasses,
  groupLabelClasses,
  hintClasses,
} from './styles'
import type { QuizBlockEditorEmits, QuizBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const answers = computed(() => props.block.answers)
const group = computed(() => `quiz-${props.block.id}`)

// The option just added, so the caret lands in it rather than at the top of the
// list the author was already working down.
const fresh = ref(-1)

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
  fresh.value = -1
  emit('update', removeAnswer(props.block, index))
}

function onAddAnswer() {
  fresh.value = props.block.answers.length
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
          :placeholder="$t('editor-quiz-question-placeholder')"
          @update:model-value="onQuestion"
        />
      </template>
    </FormField>
    <div :class="answersGroupClasses">
      <span :class="groupLabelClasses">{{ $t('editor-quiz-answers-label') }}</span>
      <p :class="hintClasses">{{ $t('editor-quiz-answers-hint') }}</p>
      <ul :class="answerListClasses">
        <QuizAnswerRow
          v-for="(answer, index) in answers"
          :key="`${group}-${index}`"
          :name="group"
          :index="index"
          :text="answer"
          :right="index === props.block.rightAnswer"
          :autofocus="index === fresh"
          :frozen="props.frozen"
          @text="onAnswerText"
          @right="onRight"
          @remove="onRemoveAnswer"
        />
      </ul>
      <Button v-if="!props.frozen" size="sm" variant="ghost" @click="onAddAnswer">
        {{ $t('editor-quiz-answer-add') }}
      </Button>
    </div>
  </div>
</template>
