<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { mutedClasses } from '@/shared/ui'

import type { CourseCardProps } from '../types'
import { cardClasses, headingClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CourseCardProps>()

/* --------------------------------- State ---------------------------------- */

const to = computed(() => ({
  name: 'course',
  params: { code: props.code, courseId: props.course.id },
}))
</script>

<template>
  <article :class="cardClasses">
    <RouterLink :class="headingClasses" :to="to">{{ props.course.name }}</RouterLink>
    <p v-if="props.course.description" :class="mutedClasses">{{ props.course.description }}</p>
  </article>
</template>
