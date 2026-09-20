<script setup lang="ts">
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { MarkdownText } from '@/features/edit-lesson-content'

import { answersClasses, mutedClasses } from './styles'
import type { QuizPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<QuizPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const question = computed(() => props.block.question || $t('editor-preview-quiz-empty'))

// The explanation is deliberately absent: the student is shown it only once the
// answer is in, and this is the screen as it looks before one.
const answers = computed(() => props.block.answers)
</script>

<template>
  <div>
    <MarkdownText :markdown="question" inline />
    <ol :class="answersClasses">
      <li v-for="(answer, index) in answers" :key="index">
        <MarkdownText :markdown="answer" inline />
        <span v-if="index === props.block.rightAnswer" :class="mutedClasses">
          {{ $t('editor-preview-quiz-right') }}
        </span>
      </li>
    </ol>
  </div>
</template>
