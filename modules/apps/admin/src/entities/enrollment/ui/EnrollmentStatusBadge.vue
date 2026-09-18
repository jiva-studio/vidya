<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'

import { enrollmentLabels, enrollmentTones } from './statusTone'
import type { EnrollmentStatusBadgeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EnrollmentStatusBadgeProps>(), { inQueue: false })

/* --------------------------------- State ---------------------------------- */

const tone = computed(() => (props.inQueue ? 'info' : enrollmentTones[props.status]))
const label = computed(() =>
  props.inQueue ? 'enrollment-status-in-queue' : enrollmentLabels[props.status],
)
</script>

<template>
  <Badge :tone="tone">{{ $t(label) }}</Badge>
</template>
