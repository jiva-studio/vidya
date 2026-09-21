<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { describeAnswer } from '@/shared/lib'
import { useOutboxView } from '@/shared/sync'
import { answerRowClasses, commentClasses, mutedClasses, SubmissionNotice } from '@/shared/ui'

import type { HomeworkCardProps } from '../types'
import { cardClasses, headingClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkCardProps>()

/* --------------------------------- State ---------------------------------- */

const outbox = useOutboxView()

const badge = computed(() => describeAnswer(props.card.answer.status))

// An answer whose lesson has not arrived is still the student's work and is
// still listed; what is missing is the address to open it at.
const address = computed(() =>
  props.card.schoolCode === null || props.card.courseId === null || props.card.lessonId === null
    ? null
    : `/s/${props.card.schoolCode}/c/${props.card.courseId}/l/${props.card.lessonId}`,
)
</script>

<template>
  <li :class="cardClasses">
    <div :class="answerRowClasses">
      <RouterLink v-if="address" :class="headingClasses" :to="address">
        {{ props.card.lessonTitle }}
      </RouterLink>
      <span v-else :class="mutedClasses">{{ $t('answer-lesson-not-here') }}</span>

      <Badge :tone="badge.tone">{{ $t(badge.key) }}</Badge>
    </div>

    <p v-if="props.card.courseName" :class="mutedClasses">{{ props.card.courseName }}</p>

    <p v-if="props.card.answer.grade !== null">
      {{ $t('answer-grade', { grade: props.card.answer.grade }) }}
    </p>

    <p v-if="props.card.answer.comment" :class="commentClasses">
      {{ props.card.answer.comment }}
    </p>

    <SubmissionNotice
      :state="outbox.state('homework', props.card.answer.id)"
      :reason="outbox.reason('homework', props.card.answer.id)"
    />
  </li>
</template>
