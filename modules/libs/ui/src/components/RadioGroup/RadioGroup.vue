<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

import RadioGroupItem from './RadioGroupItem.vue'
import { cn } from '../../lib/utils'
import { groupVariants } from './styles'
import type { RadioGroupEmits, RadioGroupProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<RadioGroupProps>(), {
  modelValue: undefined,
  orientation: 'vertical',
  disabled: false,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<RadioGroupEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(value: unknown) {
  emit('update:modelValue', String(value))
}
</script>

<template>
  <RadioGroupRoot
    :model-value="props.modelValue"
    :disabled="props.disabled"
    :orientation="props.orientation"
    :class="cn(groupVariants({ orientation: props.orientation }), props.class)"
    @update:model-value="onUpdate"
  >
    <RadioGroupItem v-for="option in props.options" :key="option.value" :option="option" />
  </RadioGroupRoot>
</template>
