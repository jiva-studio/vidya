<script setup lang="ts">
import { computed, useId } from 'vue'

import Label from '../Label'
import { cn } from '../../lib/utils'
import { errorClasses, fieldClasses, hintClasses } from './styles'
import type { FormFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<FormFieldProps>(), {
  label: undefined,
  hint: undefined,
  error: undefined,
  required: false,
  class: undefined,
})

/* --------------------------------- State ---------------------------------- */

const fieldId = useId()
const hintId = `${fieldId}-hint`
const errorId = `${fieldId}-error`

const invalid = computed(() => Boolean(props.error))
const showHint = computed(() => Boolean(props.hint) && !invalid.value)
const describedBy = computed(() => describedByFor())

/* -------------------------------- Helpers --------------------------------- */

// The error replaces the hint rather than joining it: a screen reader that
// reads both makes the reason for the rejection the second thing heard.
function describedByFor(): string | undefined {
  if (props.error) return errorId
  if (props.hint) return hintId
  return undefined
}
</script>

<template>
  <div :class="cn(fieldClasses, props.class)">
    <Label v-if="props.label" :for="fieldId" :required="props.required">{{ props.label }}</Label>
    <slot :id="fieldId" :described-by="describedBy" :invalid="invalid" />
    <p v-if="showHint" :id="hintId" :class="hintClasses">{{ props.hint }}</p>
    <p v-if="props.error" :id="errorId" :class="errorClasses" role="alert">{{ props.error }}</p>
  </div>
</template>
