<script setup lang="ts">
import Spinner from '../Spinner'
import { cn } from '../../lib/utils'
import { busyLabelClasses, busyOverlayClasses, buttonVariants } from './styles'
import type { ButtonEmits, ButtonProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  busy: false,
  busyLabel: 'Working',
  fullWidth: false,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ButtonEmits>()

/* -------------------------------- Handlers -------------------------------- */

// A request is in flight: the second click would send a second one.
function onClick(event: MouseEvent) {
  if (props.disabled || props.busy) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :type="props.type"
    :class="
      cn(
        buttonVariants({ variant: props.variant, size: props.size, fullWidth: props.fullWidth }),
        props.class,
      )
    "
    :disabled="props.disabled || props.busy"
    :aria-busy="props.busy"
    @click="onClick"
  >
    <span
      class="inline-flex items-center justify-center gap-1.5"
      :class="props.busy ? busyLabelClasses : undefined"
    >
      <slot />
    </span>
    <span v-if="props.busy" :class="busyOverlayClasses">
      <Spinner :size="props.size === 'sm' ? 'sm' : 'md'" :label="props.busyLabel" />
    </span>
  </button>
</template>
