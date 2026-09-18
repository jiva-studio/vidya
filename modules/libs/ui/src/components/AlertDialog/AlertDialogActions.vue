<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel } from 'reka-ui'

import Button from '../Button'
import { cn } from '../../lib/utils'
import { actionsClasses } from './styles'
import type { AlertDialogActionsEmits, AlertDialogActionsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AlertDialogActionsProps>(), {
  destructive: false,
  busy: false,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AlertDialogActionsEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <div :class="cn(actionsClasses, props.class)">
    <AlertDialogCancel as-child>
      <Button variant="secondary" :disabled="props.busy" @click="onCancel">
        {{ props.cancelLabel }}
      </Button>
    </AlertDialogCancel>
    <AlertDialogAction as-child>
      <Button
        :variant="props.destructive ? 'danger' : 'primary'"
        :busy="props.busy"
        @click="onConfirm"
      >
        {{ props.confirmLabel }}
      </Button>
    </AlertDialogAction>
  </div>
</template>
