<script setup lang="ts">
import { computed } from 'vue'

import { answersClasses, mutedClasses } from './styles'
import type { QuizPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<QuizPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const answers = computed(() => props.block.answers)
</script>

<template>
  <div>
    <p>{{ props.block.question || $t('editor-preview-quiz-empty') }}</p>
    <ol :class="answersClasses">
      <li v-for="(answer, index) in answers" :key="index">
        {{ answer }}
        <span v-if="index === props.block.rightAnswer" :class="mutedClasses">
          {{ $t('editor-preview-quiz-right') }}
        </span>
      </li>
    </ol>
  </div>
</template>
