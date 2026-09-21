<script setup lang="ts">
import { computed } from 'vue'

import MarkdownText from '../MarkdownText'
import { answersClasses, optionClasses, recordedClasses, rightAnswerClasses } from './styles'
import type { QuizPreviewEmits, QuizPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizPreviewProps>(), { progress: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizPreviewEmits>()

/* --------------------------------- State ---------------------------------- */

const question = computed(() => props.block.question || props.labels.emptyQuestion)

// The explanation is deliberately absent: the student is shown it only once the
// answer is in, and this is the screen as it looks before one.
const answers = computed(() => props.block.answers)

const answered = computed(() => {
  const state = props.progress?.states[props.block.id]
  return state?.type === 'quiz' ? state : undefined
})

// One answer and no second one. The key travels to nobody who has not answered,
// and a quiz that took a second answer would hand it over in two goes.
const locked = computed(() => answered.value !== undefined || props.progress?.editable === false)

/* -------------------------------- Handlers -------------------------------- */

function onChoose(index: number) {
  emit('change', { type: 'quiz', answer: index })
}

/* -------------------------------- Helpers --------------------------------- */

// A screen that names no label for the key does not mark one, which is how the
// student's copy is drawn by the same component as the author's.
function isRightAnswer(index: number): boolean {
  return Boolean(props.labels.rightAnswer) && index === props.block.rightAnswer
}
</script>

<template>
  <div>
    <MarkdownText :markdown="question" inline />

    <fieldset v-if="props.progress" :class="answersClasses">
      <label v-for="(answer, index) in answers" :key="index" :class="optionClasses">
        <input
          type="radio"
          :name="props.block.id"
          :checked="index === answered?.answer"
          :disabled="locked"
          @change="onChoose(index)"
        />
        <MarkdownText :markdown="answer" inline />
      </label>
    </fieldset>

    <ol v-else :class="answersClasses">
      <li v-for="(answer, index) in answers" :key="index">
        <MarkdownText :markdown="answer" inline />
        <span v-if="isRightAnswer(index)" :class="rightAnswerClasses">
          {{ props.labels.rightAnswer }}
        </span>
      </li>
    </ol>

    <p v-if="answered && props.progress" :class="recordedClasses">
      {{ props.progress.labels.answerRecorded }}
    </p>
  </div>
</template>
