<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { translate } from '@/shared/i18n'
import { describePlace } from '@/shared/lib'

import type { LearningCardProps } from '../types'
import { cardClasses, headingClasses, schoolClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LearningCardProps>()

/* --------------------------------- State ---------------------------------- */

const badge = computed(() => describePlace(props.card.status))

const title = computed(() => props.card.courseName ?? translate('learning-course-unnamed'))

const schoolName = computed(() => props.card.schoolName ?? translate('learning-school-unnamed'))

// Both addresses are spelled with the school's public code, and a school whose
// own row has not arrived has no code yet: the card then names it in plain
// text rather than linking somewhere that cannot be resolved.
const schoolTo = computed(() => {
  const code = props.card.schoolCode
  return code === null ? undefined : { name: 'school', params: { code } }
})

const courseTo = computed(() => {
  const code = props.card.schoolCode
  return code === null
    ? undefined
    : { name: 'course', params: { code, courseId: props.card.courseId } }
})
</script>

<template>
  <article :class="cardClasses">
    <RouterLink v-if="schoolTo" :class="schoolClasses" :to="schoolTo">{{ schoolName }}</RouterLink>
    <span v-else :class="schoolClasses">{{ schoolName }}</span>

    <RouterLink v-if="courseTo" :class="headingClasses" :to="courseTo">{{ title }}</RouterLink>
    <span v-else :class="headingClasses">{{ title }}</span>

    <Badge :tone="badge.tone">{{ $t(badge.key) }}</Badge>
  </article>
</template>
