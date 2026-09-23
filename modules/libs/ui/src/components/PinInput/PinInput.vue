<script setup lang="ts">
import { PinInputInput, PinInputRoot } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '../../lib/utils'
import { pinInputRootClasses, pinInputSlotClasses } from './styles'
import type { PinInputEmits, PinInputProps } from './types'

defineOptions({
  name: 'PinInput',
})

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PinInputProps>(), {
  modelValue: '',
  length: 8,
  disabled: false,
  invalid: false,
  otp: true,
  type: 'text',
  placeholder: '',
  name: 'one-time-code',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PinInputEmits>()

/* --------------------------------- State ---------------------------------- */

const digits = computed<string[]>({
  get() {
    if (Array.isArray(props.modelValue)) {
      return props.modelValue
    }
    return (props.modelValue || '').split('')
  },
  set(val) {
    const str = val.join('')
    emit('update:modelValue', str)
  },
})

function onComplete(val: string[] | number[]) {
  emit('complete', val.join(''))
}
</script>

<template>
  <PinInputRoot
    :model-value="digits"
    :type="props.type"
    :otp="props.otp"
    :disabled="props.disabled"
    :placeholder="props.placeholder"
    :name="props.name"
    :class="cn(pinInputRootClasses, props.class)"
    @update:model-value="digits = $event as string[]"
    @complete="onComplete"
  >
    <div class="flex w-full items-center justify-between gap-2">
      <PinInputInput
        v-for="(_, index) in props.length"
        :key="index"
        :index="index"
        :disabled="props.disabled"
        :class="cn(pinInputSlotClasses, props.invalid && 'border-[var(--color-danger-border)]')"
      />
    </div>
  </PinInputRoot>
</template>
