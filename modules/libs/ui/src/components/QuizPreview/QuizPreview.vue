<script setup lang="ts">
import { computed } from 'vue'

import MarkdownText from '../MarkdownText'
import { answersClasses, rightAnswerClasses } from './styles'
import type { QuizPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<QuizPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const question = computed(() => props.block.question || props.labels.emptyQuestion)

// The explanation is deliberately absent: the student is shown it only once the
// answer is in, and this is the screen as it looks before one.
const answers = computed(() => props.block.answers)

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
    <ol :class="answersClasses">
      <li v-for="(answer, index) in answers" :key="index">
        <MarkdownText :markdown="answer" inline />
        <span v-if="isRightAnswer(index)" :class="rightAnswerClasses">
          {{ props.labels.rightAnswer }}
        </span>
      </li>
    </ol>
  </div>
</template>
