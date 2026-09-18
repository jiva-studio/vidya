<template>
  <CourseCard
    v-for="item in items"
    :key="item.id"
    :name="item.name"
    :description="item.description"
    @click="() => onCourseCardClicked(item.id)"
  />
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import type { CourseSummary } from '@vidya/protocol'

import CourseCard from './CourseCard.vue'

/* --------------------------------- Props ---------------------------------- */

defineProps<{ items: CourseSummary[] }>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ click: [courseId: CourseId] }>()

/* -------------------------------- Handlers -------------------------------- */

function onCourseCardClicked(courseId: CourseId) {
  emit('click', courseId)
}
</script>
