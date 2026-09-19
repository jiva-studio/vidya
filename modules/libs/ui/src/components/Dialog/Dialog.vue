<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTrigger } from 'reka-ui'

import DialogHeader from './DialogHeader.vue'
import { cn } from '../../lib/utils'
import { contentVariants, overlayClasses } from './styles'
import type { DialogEmits, DialogProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<DialogProps>(), {
  open: false,
  description: undefined,
  size: 'md',
  closeLabel: 'Close',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<DialogEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpenChange(open: boolean) {
  emit('update:open', open)
}
</script>

<template>
  <DialogRoot :open="props.open" @update:open="onOpenChange">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay :class="overlayClasses" />
      <DialogContent :class="cn(contentVariants({ size: props.size }), props.class)">
        <DialogHeader
          :title="props.title"
          :description="props.description"
          :close-label="props.closeLabel"
        />
        <slot />
        <slot name="footer" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
