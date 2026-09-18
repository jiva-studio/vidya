<script setup lang="ts">
import { Input } from '@vidya/ui'
import { computed } from 'vue'

import type { GradeInputEmits, GradeInputProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GradeInputProps>(), {
  modelValue: undefined,
  disabled: false,
  invalid: false,
  id: undefined,
  describedBy: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GradeInputEmits>()

/* --------------------------------- State ---------------------------------- */

const shown = computed(() => (props.modelValue === undefined ? '' : String(props.modelValue)))

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', parse(value))
}

/* -------------------------------- Helpers --------------------------------- */

function parse(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}
</script>

<template>
  <Input
    :id="props.id"
    :model-value="shown"
    type="number"
    inputmode="numeric"
    :disabled="props.disabled"
    :invalid="props.invalid"
    :described-by="props.describedBy"
    @update:model-value="onInput"
  />
</template>
