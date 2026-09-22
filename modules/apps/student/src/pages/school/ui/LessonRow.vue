<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { mutedClasses } from '@/shared/ui'

import type { LessonRowProps } from '../types'
import { numberClasses, rowClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonRowProps>()

/* --------------------------------- State ---------------------------------- */

const to = computed(() => ({
  name: 'lesson',
  params: { code: props.code, courseId: props.courseId, lessonId: props.row.id },
}))

// A lesson whose published version has not reached this machine has nothing to
// count and nothing to open yet, and says so rather than showing "0 of 0".
const counted = computed(() => props.row.held && props.row.blocks > 0)
</script>

<template>
  <li :class="rowClasses">
    <span :class="numberClasses">{{ props.row.number }}</span>
    <RouterLink :to="to">{{ props.row.title }}</RouterLink>

    <span v-if="counted" :class="mutedClasses">
      {{ $t('lesson-done', { done: props.row.done, blocks: props.row.blocks }) }}
    </span>
    <span v-else :class="mutedClasses">{{ $t('lesson-not-here') }}</span>
  </li>
</template>
