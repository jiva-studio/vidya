<script setup lang="ts">
import { Badge, Button } from '@vidya/ui'
import { computed } from 'vue'

import { describePlace } from '@/shared/lib'
import { mutedClasses, SubmissionNotice } from '@/shared/ui'

import type { CoursePlaceProps } from '../types'
import { placeClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CoursePlaceProps>()

/* --------------------------------- State ---------------------------------- */

const badge = computed(() => (props.status === null ? null : describePlace(props.status)))
</script>

<template>
  <div :class="placeClasses">
    <Badge v-if="badge" :tone="badge.tone">{{ $t(badge.key) }}</Badge>

    <SubmissionNotice
      v-if="badge && props.submission"
      :state="props.submission"
      :reason="props.reason"
    />

    <template v-else>
      <Button disabled>{{ $t('course-ask') }}</Button>
      <p :class="mutedClasses">{{ $t('course-ask-elsewhere') }}</p>
    </template>
  </div>
</template>
