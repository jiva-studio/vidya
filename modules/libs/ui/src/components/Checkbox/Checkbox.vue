<script setup lang="ts">
import { Check, Minus } from 'lucide-vue-next'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { computed, useId } from 'vue'

import { cn } from '../../lib/utils'
import {
  boxClasses,
  descriptionClasses,
  labelClasses,
  markClasses,
  textClasses,
  wrapperClasses,
} from './styles'
import type { CheckboxEmits, CheckboxProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CheckboxProps>(), {
  modelValue: false,
  label: undefined,
  description: undefined,
  disabled: false,
  indeterminate: false,
  id: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CheckboxEmits>()

/* --------------------------------- State ---------------------------------- */

const generatedId = useId()
const controlId = computed(() => props.id ?? generatedId)
const state = computed(() => (props.indeterminate ? 'indeterminate' : props.modelValue))

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(value: boolean | 'indeterminate') {
  emit('update:modelValue', value === true)
}
</script>

<template>
  <div :class="cn(wrapperClasses, props.description ? 'items-start' : 'items-center', props.class)">
    <CheckboxRoot
      :id="controlId"
      :model-value="state"
      :disabled="props.disabled"
      :class="cn(boxClasses, props.description && 'mt-[2px]')"
      @update:model-value="onUpdate"
    >
      <CheckboxIndicator>
        <Minus v-if="props.indeterminate" :class="markClasses" />
        <Check v-else :class="markClasses" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <div v-if="props.label || props.description" :class="textClasses">
      <label v-if="props.label" :for="controlId" :class="labelClasses">{{ props.label }}</label>
      <span v-if="props.description" :class="descriptionClasses">{{ props.description }}</span>
    </div>
  </div>
</template>
