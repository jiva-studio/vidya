<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import {
  SelectContent,
  SelectIcon,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from 'reka-ui'

import SelectList from './SelectList.vue'
import { cn } from '../../lib/utils'
import { iconClasses, surfaceClasses, triggerVariants } from './styles'
import type { SelectEmits, SelectProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SelectProps>(), {
  modelValue: undefined,
  placeholder: 'Select',
  disabled: false,
  invalid: false,
  id: undefined,
  describedBy: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SelectEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(value: unknown) {
  emit('update:modelValue', String(value))
}
</script>

<template>
  <SelectRoot
    :model-value="props.modelValue"
    :disabled="props.disabled"
    @update:model-value="onUpdate"
  >
    <SelectTrigger
      :id="props.id"
      :aria-invalid="props.invalid || undefined"
      :aria-describedby="props.describedBy"
      :class="cn(triggerVariants({ invalid: props.invalid }), props.class)"
    >
      <SelectValue :placeholder="props.placeholder" />
      <SelectIcon>
        <ChevronDown :class="iconClasses" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent :class="surfaceClasses" position="popper" :side-offset="4">
        <SelectList :options="props.options" />
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
