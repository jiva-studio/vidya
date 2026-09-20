<template>
  <WithListHeader :title="$t('lessons-title')">
    <LessonsListItem
      v-for="(lesson, idx) in items"
      :key="lesson.id"
      :item="items[idx]"
      @click="() => onLessonClicked(lesson.id)"
    />
  </WithListHeader>
</template>

<script setup lang="ts">
import type { LessonId } from '@vidya/domain'

import LessonsListItem from './LessonsListItem.vue'
import { WithListHeader } from '@/design'
import type { LessonsListEmits, LessonsListProps } from './types'
/* -------------------------------------------------------------------------- */
/*                                  Interface                                 */
/* -------------------------------------------------------------------------- */

defineProps<LessonsListProps>()

const emit = defineEmits<LessonsListEmits>()

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                  */
/* -------------------------------------------------------------------------- */

function onLessonClicked(lessonId: LessonId) {
  emit('click', lessonId)
}
</script>
