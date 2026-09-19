<script setup lang="ts">
import { cn } from '../../lib/utils'
import { textareaVariants } from './styles'
import type { TextareaEmits, TextareaProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TextareaProps>(), {
  modelValue: '',
  rows: 4,
  placeholder: undefined,
  disabled: false,
  readonly: false,
  invalid: false,
  id: undefined,
  describedBy: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TextareaEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function onBlur(event: FocusEvent) {
  emit('blur', event)
}
</script>

<template>
  <textarea
    :id="props.id"
    :class="cn(textareaVariants({ invalid: props.invalid }), props.class)"
    :rows="props.rows"
    :value="props.modelValue"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :aria-invalid="props.invalid || undefined"
    :aria-describedby="props.describedBy"
    @input="onInput"
    @blur="onBlur"
  />
</template>
