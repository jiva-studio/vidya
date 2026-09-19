<script setup lang="ts">
import { FormField, Select } from '@vidya/ui'

import type { DefaultRoleFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<DefaultRoleFieldProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <FormField
    :label="$t('schools-settings-default-role')"
    :hint="$t('schools-settings-default-role-hint')"
  >
    <template #default="field">
      <Select
        :id="field.id"
        :model-value="props.modelValue"
        :options="props.options"
        :placeholder="$t('schools-settings-default-role-none')"
        :described-by="field.describedBy"
        @update:model-value="onSelect"
      />
    </template>
  </FormField>
</template>
