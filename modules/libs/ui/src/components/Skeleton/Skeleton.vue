<script setup lang="ts">
import { cn } from '../../lib/utils'
import { skeletonVariants, stackClasses } from './styles'
import type { SkeletonProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SkeletonProps>(), {
  shape: 'text',
  lines: 1,
  class: undefined,
})
</script>

<template>
  <div :class="stackClasses" role="status" aria-busy="true" aria-live="polite">
    <span
      v-for="line in props.lines"
      :key="line"
      :class="cn(skeletonVariants({ shape: props.shape }), props.class)"
    />
  </div>
</template>
