<script setup lang="ts">
import { ToastPortal, ToastProvider, ToastViewport } from 'reka-ui'

import Toast from './Toast.vue'
import { cn } from '../../lib/utils'
import { viewportClasses } from './styles'
import type { ToasterEmits, ToasterProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ToasterProps>(), {
  label: 'Notifications',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ToasterEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onDismiss(id: string) {
  emit('dismiss', id)
}

function onAction(id: string) {
  emit('action', id)
}
</script>

<template>
  <ToastProvider :label="props.label">
    <Toast
      v-for="toast in props.toasts"
      :key="toast.id"
      :toast="toast"
      @dismiss="onDismiss"
      @action="onAction"
    />
    <ToastPortal>
      <ToastViewport :class="cn(viewportClasses, props.class)" />
    </ToastPortal>
  </ToastProvider>
</template>
