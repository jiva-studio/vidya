<script setup lang="ts">
import { FormField, Input } from '@vidya/ui'

import type { SchoolNameFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolNameFieldProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <FormField :label="$t('schools-form-name')" :error="props.error" required>
    <template #default="field">
      <Input
        :id="field.id"
        :model-value="props.modelValue"
        name="name"
        :described-by="field.describedBy"
        :invalid="field.invalid"
        :disabled="props.disabled"
        @update:model-value="onInput"
      />
    </template>
  </FormField>
</template>
