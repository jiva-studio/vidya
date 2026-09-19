<template>
  <CourseCard
    v-for="item in items"
    :key="item.id"
    :name="item.name"
    :description="item.description"
    :school-name="item.schoolName"
    :school-logo-url="item.schoolLogoUrl"
    @click="() => onCourseCardClicked(item.id)"
  />
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'

import CourseCard from './CourseCard.vue'
import type { CoursesListEmits, CoursesListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

defineProps<CoursesListProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CoursesListEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onCourseCardClicked(courseId: CourseId) {
  emit('click', courseId)
}
</script>
