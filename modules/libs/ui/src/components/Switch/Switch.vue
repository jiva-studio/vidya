<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed, useId } from 'vue'

import { cn } from '../../lib/utils'
import {
  descriptionClasses,
  labelClasses,
  textClasses,
  thumbClasses,
  trackClasses,
  wrapperClasses,
} from './styles'
import type { SwitchEmits, SwitchProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SwitchProps>(), {
  modelValue: false,
  label: undefined,
  description: undefined,
  disabled: false,
  id: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SwitchEmits>()

/* --------------------------------- State ---------------------------------- */

const generatedId = useId()
const controlId = computed(() => props.id ?? generatedId)

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(value: boolean) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div :class="cn(wrapperClasses, props.class)">
    <div v-if="props.label || props.description" :class="textClasses">
      <label v-if="props.label" :for="controlId" :class="labelClasses">{{ props.label }}</label>
      <span v-if="props.description" :class="descriptionClasses">{{ props.description }}</span>
    </div>
    <SwitchRoot
      :id="controlId"
      :model-value="props.modelValue"
      :disabled="props.disabled"
      :class="trackClasses"
      @update:model-value="onUpdate"
    >
      <SwitchThumb :class="thumbClasses" />
    </SwitchRoot>
  </div>
</template>
