<script setup lang="ts">
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui'

import AlertDialogActions from './AlertDialogActions.vue'
import { cn } from '../../lib/utils'
import { contentClasses, descriptionClasses, overlayClasses, titleClasses } from './styles'
import type { AlertDialogEmits, AlertDialogProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AlertDialogProps>(), {
  open: false,
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
  busy: false,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AlertDialogEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpenChange(open: boolean) {
  emit('update:open', open)
}

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <AlertDialogRoot :open="props.open" @update:open="onOpenChange">
    <AlertDialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay :class="overlayClasses" />
      <AlertDialogContent :class="cn(contentClasses, props.class)">
        <AlertDialogTitle :class="titleClasses">{{ props.title }}</AlertDialogTitle>
        <AlertDialogDescription :class="descriptionClasses">
          {{ props.description }}
        </AlertDialogDescription>
        <AlertDialogActions
          :confirm-label="props.confirmLabel"
          :cancel-label="props.cancelLabel"
          :destructive="props.destructive"
          :busy="props.busy"
          @confirm="onConfirm"
          @cancel="onCancel"
        />
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
