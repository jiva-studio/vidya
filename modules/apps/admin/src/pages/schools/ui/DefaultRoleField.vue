<script setup lang="ts">
import { FormField, Select } from '@vidya/ui'

import type { DefaultRoleFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<DefaultRoleFieldProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string | number | undefined) {
  emit('update:modelValue', value ? String(value) : '')
}
</script>

<template>
  <FormField :label="$t('schools-settings-default-role')">
    <template #default="field">
      <Select
        :id="field.id"
        :model-value="props.modelValue"
        :options="props.options"
        :placeholder="$t('schools-settings-default-role-none')"
        :disabled="props.disabled"
        @update:model-value="onSelect"
      />
    </template>
  </FormField>
</template>
