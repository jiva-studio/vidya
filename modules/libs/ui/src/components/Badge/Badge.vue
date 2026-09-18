<script setup lang="ts">
import { cn } from '../../lib/utils'
import { badgeVariants } from './styles'
import type { BadgeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BadgeProps>(), { tone: 'neutral', class: undefined })
</script>

<template>
  <span :class="cn(badgeVariants({ tone: props.tone }), props.class)">
    <slot />
  </span>
</template>
