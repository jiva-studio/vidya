<script setup lang="ts">
import Button from '../Button'
import { cn } from '../../lib/utils'
import { actionsVariants, errorClasses } from './styles'
import type { FormActionsEmits, FormActionsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<FormActionsProps>(), {
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  busy: false,
  disabled: false,
  destructive: false,
  align: 'end',
  error: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<FormActionsEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSubmit() {
  emit('submit')
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <div :class="cn(actionsVariants({ align: props.align }), props.class)">
    <p v-if="props.error" :class="errorClasses" role="alert">{{ props.error }}</p>
    <slot />
    <Button variant="secondary" :disabled="props.busy" @click="onCancel">
      {{ props.cancelLabel }}
    </Button>
    <Button
      :variant="props.destructive ? 'danger' : 'primary'"
      :busy="props.busy"
      :disabled="props.disabled"
      @click="onSubmit"
    >
      {{ props.submitLabel }}
    </Button>
  </div>
</template>
