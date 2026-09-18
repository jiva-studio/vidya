<script setup lang="ts">
import { HomeworkStatusBadge } from '@/entities/homework'
import { formatDateTime } from '@/shared/lib'

import type { HomeworkAnswerProps } from '../types'
import { answerClasses, metaClasses, titleClasses, workClasses } from './styles'
import SupersededVersionNotice from './SupersededVersionNotice.vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<HomeworkAnswerProps>(), {
  row: undefined,
  reviewerName: undefined,
  answeredLessonId: undefined,
})
</script>

<template>
  <article :class="workClasses">
    <header :class="metaClasses">
      <span :class="titleClasses">
        {{ props.row?.studentName ?? $t('homework-student-unknown') }}
      </span>
      <HomeworkStatusBadge :status="props.work.status" />
      <span v-if="props.row?.courseName">{{ props.row.courseName }}</span>
      <span v-if="props.row?.groupName">{{ props.row.groupName }}</span>
      <span>{{ $t('homework-submitted', { at: formatDateTime(props.work.submittedAt) }) }}</span>
    </header>
    <SupersededVersionNotice
      v-if="props.work.answeredSupersededVersion"
      :lesson-version-id="props.work.lessonVersionId"
      :lesson-id="props.answeredLessonId"
    />
    <p :class="answerClasses">{{ props.work.text }}</p>
    <p v-if="props.work.reviewedAt" :class="metaClasses">
      {{
        $t('homework-reviewed-by', {
          who: props.reviewerName ?? $t('homework-student-unknown'),
          at: formatDateTime(props.work.reviewedAt),
        })
      }}
    </p>
  </article>
</template>
