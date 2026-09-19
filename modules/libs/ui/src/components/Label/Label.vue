<script setup lang="ts">
import { cn } from '../../lib/utils'
import { labelClasses, requiredMarkClasses } from './styles'
import type { LabelProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LabelProps>(), {
  for: undefined,
  required: false,
  class: undefined,
})
</script>

<template>
  <label :for="props.for" :class="cn(labelClasses, props.class)">
    <slot />
    <span v-if="props.required" :class="requiredMarkClasses" aria-hidden="true">*</span>
  </label>
</template>
