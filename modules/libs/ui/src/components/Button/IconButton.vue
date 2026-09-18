<script setup lang="ts">
import { computed, onMounted } from 'vue'

import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import { cn } from '../../lib/utils'
import { iconButtonVariants } from './styles'
import type { IconButtonEmits, IconButtonProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<IconButtonProps>(), {
  variant: 'ghost',
  size: 'sm',
  type: 'button',
  disabled: false,
  busy: false,
  tooltipSide: 'top',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<IconButtonEmits>()

/* --------------------------------- State ---------------------------------- */

const name = computed(() => props.label.trim())

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  if (import.meta.env.DEV && !name.value) {
    console.warn('IconButton: label is the only name this button has, and it is empty.')
  }
})

/* -------------------------------- Handlers -------------------------------- */

function onClick(event: MouseEvent) {
  if (props.disabled || props.busy) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <Tooltip :text="name" :side="props.tooltipSide">
    <button
      :type="props.type"
      :class="cn(iconButtonVariants({ variant: props.variant, size: props.size }), props.class)"
      :disabled="props.disabled || props.busy"
      :aria-label="name"
      :aria-busy="props.busy"
      @click="onClick"
    >
      <Spinner v-if="props.busy" size="sm" :label="name" />
      <slot v-else />
    </button>
  </Tooltip>
</template>
