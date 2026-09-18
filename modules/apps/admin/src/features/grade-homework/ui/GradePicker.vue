<script setup lang="ts">
import type { ButtonVariant } from '@vidya/ui'
import { Button, Input } from '@vidya/ui'
import { computed } from 'vue'

import { parseGrade, QUICK_GRADES } from '../model'
import type { GradePickerEmits, GradePickerProps } from '../types'
import { fieldClasses, marksClasses, pickerClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GradePickerProps>(), {
  modelValue: undefined,
  disabled: false,
  id: undefined,
  describedBy: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GradePickerEmits>()

/* --------------------------------- State ---------------------------------- */

const shown = computed(() => (props.modelValue === undefined ? '' : String(props.modelValue)))

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', parseGrade(String(value)))
}

function onMark(mark: number) {
  emit('update:modelValue', mark)
}

/* -------------------------------- Helpers --------------------------------- */

function variantOf(mark: number): ButtonVariant {
  return mark === props.modelValue ? 'primary' : 'secondary'
}
</script>

<template>
  <div :class="pickerClasses">
    <Input
      :id="props.id"
      :class="fieldClasses"
      :model-value="shown"
      type="text"
      inputmode="numeric"
      :disabled="props.disabled"
      :described-by="props.describedBy"
      @update:model-value="onInput"
    />
    <div :class="marksClasses">
      <Button
        v-for="mark in QUICK_GRADES"
        :key="mark"
        type="button"
        size="sm"
        :variant="variantOf(mark)"
        :disabled="props.disabled"
        @click="onMark(mark)"
      >
        {{ mark }}
      </Button>
    </div>
  </div>
</template>
