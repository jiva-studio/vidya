<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { describePlace } from '@/shared/lib'
import { SubmissionNotice } from '@/shared/ui'

import type { CoursePlaceProps } from '../types'
import { actionLinkClasses, placeClasses, quietLinkClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CoursePlaceProps>()

/* --------------------------------- State ---------------------------------- */

const badge = computed(() => (props.status === null ? null : describePlace(props.status)))

const enroll = computed(() => ({
  name: 'enroll',
  params: { code: props.code, courseId: props.courseId },
}))

const place = computed(() => ({
  name: 'place',
  params: { code: props.code, courseId: props.courseId },
}))
</script>

<template>
  <div :class="placeClasses">
    <template v-if="badge">
      <Badge :tone="badge.tone">{{ $t(badge.key) }}</Badge>
      <RouterLink :class="quietLinkClasses" :to="place">{{ $t('course-place') }}</RouterLink>

      <SubmissionNotice v-if="props.submission" :state="props.submission" :reason="props.reason" />
    </template>

    <RouterLink v-else :class="actionLinkClasses" :to="enroll">{{ $t('course-ask') }}</RouterLink>
  </div>
</template>
