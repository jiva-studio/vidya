<template>
  <WithListHeader :title="$t('lessons')">
    <LessonsListItem
      v-for="(lesson, idx) in items"
      :key="lesson.id"
      :item="items[idx]"
      @click="() => onLessonClicked(lesson.id)"
    />
  </WithListHeader>
</template>

<script setup lang="ts">
import type { LessonSummary } from '@vidya/protocol'

import LessonsListItem from './LessonsListItem.vue'
import { WithListHeader } from '@/design'
/* -------------------------------------------------------------------------- */
/*                                  Interface                                 */
/* -------------------------------------------------------------------------- */

defineProps<{
  items: readonly LessonSummary[]
}>()

const emit = defineEmits<{
  click: [lessonId: LessonSummary['id']]
}>()

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                  */
/* -------------------------------------------------------------------------- */

function onLessonClicked(lessonId: LessonSummary['id']) {
  emit('click', lessonId)
}
</script>

<fluent locale="en">
lessons = Lessons
</fluent>

<fluent locale="ru">
lessons = Уроки
</fluent>
