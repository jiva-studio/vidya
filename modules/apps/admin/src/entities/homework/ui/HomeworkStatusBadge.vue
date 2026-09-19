<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'

import { homeworkLabels, homeworkTones } from './statusTone'
import type { HomeworkStatusBadgeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkStatusBadgeProps>()

/* --------------------------------- State ---------------------------------- */

const tone = computed(() => homeworkTones[props.status])
const label = computed(() => homeworkLabels[props.status])
</script>

<template>
  <Badge :tone="tone">{{ $t(label) }}</Badge>
</template>
