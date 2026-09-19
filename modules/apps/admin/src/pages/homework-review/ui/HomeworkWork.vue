<script setup lang="ts">
import { Avatar } from '@vidya/ui'
import { HomeworkStatusBadge } from '@/entities/homework'
import { formatDateTime } from '@/shared/lib'

import { answerClasses, metaClasses, titleClasses, workClasses } from './styles'
import SupersededVersionNotice from './SupersededVersionNotice.vue'
import type { HomeworkWorkProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkWorkProps>()
</script>

<template>
  <article :class="workClasses">
    <header :class="metaClasses">
      <div class="inline-flex items-center gap-[var(--space-2)]">
        <Avatar :name="props.context.studentName ?? '?'" size="md" />
        <span :class="titleClasses">
          {{ props.context.studentName ?? $t('homework-student-unknown') }}
        </span>
      </div>
      <HomeworkStatusBadge :status="props.work.status" />
      <span v-if="props.context.courseName">{{ props.context.courseName }}</span>
      <span v-if="props.context.groupName">{{ props.context.groupName }}</span>
      <span v-if="props.context.lessonTitle">
        {{ $t('homework-lesson', { title: props.context.lessonTitle }) }}
      </span>
      <span>{{ $t('homework-submitted', { at: formatDateTime(props.work.submittedAt) }) }}</span>
    </header>
    <SupersededVersionNotice
      v-if="props.work.answeredSupersededVersion"
      :lesson-version-id="props.work.lessonVersionId"
      :lesson-id="props.context.lessonId"
    />
    <p :class="answerClasses">{{ props.work.text }}</p>
    <p v-if="props.work.reviewedAt" :class="metaClasses">
      {{
        $t('homework-reviewed-by', {
          who: props.context.reviewerName ?? $t('homework-student-unknown'),
          at: formatDateTime(props.work.reviewedAt),
        })
      }}
    </p>
  </article>
</template>
