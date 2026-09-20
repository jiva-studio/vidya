<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { cn } from '../../lib/utils'
import { contentClasses } from './styles'
import type { PopoverEmits, PopoverProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PopoverProps>(), {
  open: undefined,
  side: 'bottom',
  align: 'start',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PopoverEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpenChange(open: boolean) {
  emit('update:open', open)
}
</script>

<template>
  <PopoverRoot :open="props.open" @update:open="onOpenChange">
    <PopoverTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :class="cn(contentClasses, props.class)"
        :side="props.side"
        :align="props.align"
        :side-offset="4"
        :aria-label="props.label"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
