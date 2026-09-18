<script setup lang="ts">
import { cn } from '../../lib/utils'
import { inputVariants } from './styles'
import type { InputEmits, InputProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<InputProps>(), {
  modelValue: '',
  type: 'text',
  size: 'lg',
  placeholder: undefined,
  disabled: false,
  readonly: false,
  invalid: false,
  id: undefined,
  describedBy: undefined,
  autocomplete: undefined,
  inputmode: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<InputEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function onBlur(event: FocusEvent) {
  emit('blur', event)
}
</script>

<template>
  <input
    :id="props.id"
    :class="cn(inputVariants({ size: props.size, invalid: props.invalid }), props.class)"
    :type="props.type"
    :value="props.modelValue"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :autocomplete="props.autocomplete"
    :inputmode="props.inputmode"
    :aria-invalid="props.invalid || undefined"
    :aria-describedby="props.describedBy"
    @input="onInput"
    @blur="onBlur"
  />
</template>
