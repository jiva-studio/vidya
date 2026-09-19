<script setup lang="ts">
import { FormField, Textarea } from '@vidya/ui'

import type { SchoolAboutFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolAboutFieldProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <FormField :label="$t('schools-form-description')">
    <template #default="field">
      <Textarea
        :id="field.id"
        :model-value="props.modelValue"
        :rows="3"
        :placeholder="$t('schools-form-description-hint')"
        :described-by="field.describedBy"
        :disabled="props.disabled"
        @update:model-value="onInput"
      />
    </template>
  </FormField>
</template>
