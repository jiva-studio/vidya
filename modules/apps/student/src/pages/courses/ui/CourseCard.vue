<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { translate } from '@/shared/i18n'
import { describePlace } from '@/shared/lib'
import { actionLinkClasses, mutedClasses } from '@/shared/ui'

import type { CourseCardProps } from '../types'
import { cardClasses, headingClasses, schoolClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CourseCardProps>()

/* --------------------------------- State ---------------------------------- */

const badge = computed(() => (props.card.status === null ? null : describePlace(props.card.status)))

const schoolName = computed(() => props.card.schoolName ?? translate('courses-school-unnamed'))

// Both addresses are spelled with the school's public code, and a school that
// has not arrived has none: the card then says the name and leads nowhere,
// rather than to an address that cannot be resolved.
const schoolTo = computed(() =>
  props.card.schoolCode === null
    ? undefined
    : { name: 'school', params: { code: props.card.schoolCode } },
)

const courseTo = computed(() =>
  props.card.schoolCode === null
    ? undefined
    : { name: 'course', params: { code: props.card.schoolCode, courseId: props.card.id } },
)

const enrollTo = computed(() =>
  props.card.schoolCode === null
    ? undefined
    : { name: 'enroll', params: { code: props.card.schoolCode, courseId: props.card.id } },
)
</script>

<template>
  <article :class="cardClasses">
    <RouterLink v-if="schoolTo" :class="schoolClasses" :to="schoolTo">{{ schoolName }}</RouterLink>
    <span v-else :class="schoolClasses">{{ schoolName }}</span>

    <RouterLink v-if="courseTo" :class="headingClasses" :to="courseTo">
      {{ props.card.name }}
    </RouterLink>
    <span v-else :class="headingClasses">{{ props.card.name }}</span>

    <p v-if="props.card.description" :class="mutedClasses">{{ props.card.description }}</p>

    <Badge v-if="badge" :tone="badge.tone">{{ $t(badge.key) }}</Badge>
    <RouterLink v-else-if="enrollTo" :class="actionLinkClasses" :to="enrollTo">
      {{ $t('courses-ask') }}
    </RouterLink>
  </article>
</template>
