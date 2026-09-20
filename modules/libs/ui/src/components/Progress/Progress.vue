<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '../../lib/utils'
import { fillClasses, trackClasses } from './styles'
import type { ProgressProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ProgressProps>(), {
  class: undefined,
})

/* --------------------------------- State ---------------------------------- */

// An upload reports bytes, and a re-sent chunk or a rounded total puts the
// figure outside the range the bar and the screen reader both promise.
const percent = computed(() => Math.min(100, Math.max(0, Math.round(props.value))))
const fillStyle = computed(() => ({ width: `${percent.value}%` }))
</script>

<template>
  <div
    :class="cn(trackClasses, props.class)"
    role="progressbar"
    :aria-label="props.label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div :class="fillClasses" :style="fillStyle" />
  </div>
</template>
