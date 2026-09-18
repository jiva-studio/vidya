<script setup lang="ts">
import { cn } from '../../lib/utils'
import { spinnerVariants } from './styles'
import type { SpinnerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SpinnerProps>(), {
  size: 'md',
  label: 'Loading',
  class: undefined,
})
</script>

<template>
  <svg
    :class="cn(spinnerVariants({ size: props.size }), props.class)"
    viewBox="0 0 24 24"
    fill="none"
    role="status"
    :aria-label="props.label"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
    <path
      d="M22 12a10 10 0 0 0-10-10"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>
