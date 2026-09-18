<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { ToastAction, ToastClose, ToastDescription, ToastRoot, ToastTitle } from 'reka-ui'

import Button from '../Button'
import { cn } from '../../lib/utils'
import {
  closeClasses,
  descriptionClasses,
  iconClasses,
  textClasses,
  titleClasses,
  toastVariants,
} from './styles'
import type { ToastEmits, ToastProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ToastProps>(), { class: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ToastEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpenChange(open: boolean) {
  if (open) return
  emit('dismiss', props.toast.id)
}

function onAction() {
  emit('action', props.toast.id)
}
</script>

<template>
  <ToastRoot
    :duration="props.toast.duration"
    :class="cn(toastVariants({ tone: props.toast.tone ?? 'neutral' }), props.class)"
    @update:open="onOpenChange"
  >
    <div :class="textClasses">
      <ToastTitle :class="titleClasses">{{ props.toast.title }}</ToastTitle>
      <ToastDescription v-if="props.toast.description" :class="descriptionClasses">
        {{ props.toast.description }}
      </ToastDescription>
    </div>
    <ToastAction v-if="props.toast.actionLabel" :alt-text="props.toast.actionLabel" as-child>
      <Button variant="secondary" size="sm" @click="onAction">
        {{ props.toast.actionLabel }}
      </Button>
    </ToastAction>
    <ToastClose :class="closeClasses" aria-label="Dismiss">
      <X :class="iconClasses" />
    </ToastClose>
  </ToastRoot>
</template>
