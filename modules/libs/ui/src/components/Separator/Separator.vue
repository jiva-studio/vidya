<script setup lang="ts">
import { Separator as RekaSeparator } from 'reka-ui'

import { cn } from '../../lib/utils'
import { labelClasses, labelledClasses, separatorVariants } from './styles'
import type { SeparatorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SeparatorProps>(), {
  orientation: 'horizontal',
  label: undefined,
  class: undefined,
})
</script>

<template>
  <div v-if="props.label" :class="labelledClasses">
    <RekaSeparator :class="separatorVariants({ orientation: 'horizontal' })" />
    <span :class="labelClasses">{{ props.label }}</span>
    <RekaSeparator :class="separatorVariants({ orientation: 'horizontal' })" />
  </div>
  <RekaSeparator
    v-else
    :orientation="props.orientation"
    :class="cn(separatorVariants({ orientation: props.orientation }), props.class)"
  />
</template>
