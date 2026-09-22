<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { describeSubmission } from '@/shared/lib'

import { mutedClasses, submissionClasses } from './styles'
import type { SubmissionNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// A refusal is the state of the record and never a pop-up: it stays beside the
// work it belongs to, and the work itself stays on this machine.
const props = defineProps<SubmissionNoticeProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const badge = computed(() => describeSubmission(props.state))
const explanation = computed(() =>
  props.reason === undefined ? null : $t(`sync-rejection-${props.reason}`),
)
</script>

<template>
  <div :class="submissionClasses" :data-state="props.state">
    <Badge :tone="badge.tone">{{ $t(badge.key) }}</Badge>
    <p :class="mutedClasses">{{ $t(badge.hintKey) }}</p>

    <template v-if="props.state === 'rejected' && explanation">
      <p :class="mutedClasses" data-reason>{{ explanation }}</p>
      <p :class="mutedClasses">{{ $t('sync-rejection-kept-here') }}</p>
    </template>
  </div>
</template>
