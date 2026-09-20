<script setup lang="ts">
import { FormField, Input } from '@vidya/ui'

import type { SchoolLogoFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolLogoFieldProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <FormField :label="$t('schools-form-logo')" :error="props.error">
    <template #default="field">
      <Input
        :id="field.id"
        :model-value="props.modelValue"
        name="logoUrl"
        :placeholder="$t('schools-form-logo-hint')"
        :described-by="field.describedBy"
        :invalid="field.invalid"
        :disabled="props.disabled"
        @update:model-value="onInput"
      />
    </template>
  </FormField>
</template>
