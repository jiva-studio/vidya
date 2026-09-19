<script setup lang="ts">
import Button from '../Button'
import { cn } from '../../lib/utils'
import { footerVariants, errorClasses } from './styles'
import type { FormFooterEmits, FormFooterProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<FormFooterProps>(), {
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

const emit = defineEmits<FormFooterEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSubmit() {
  emit('submit')
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <div :class="cn(footerVariants({ align: props.align }), props.class)">
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
