<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { FormField, FormSection, Input, Textarea } from '@vidya/ui'

import { PermissionsPicker } from '@/entities/role'

import type { RoleFormFieldsEmits, RoleFormFieldsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<RoleFormFieldsProps>(), {
  nameError: undefined,
  busy: false,
  readonly: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<RoleFormFieldsEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onName(value: string) {
  emit('update:name', value)
}

function onDescription(value: string) {
  emit('update:description', value)
}

function onPermissions(value: PermissionKey[]) {
  emit('update:permissions', value)
}
</script>

<template>
  <FormField
    :label="$t('roles-form-name')"
    :hint="$t('roles-form-name-hint')"
    :error="props.nameError"
    required
  >
    <template #default="field">
      <Input
        :id="field.id"
        :model-value="props.name"
        name="name"
        :described-by="field.describedBy"
        :invalid="field.invalid"
        :disabled="props.busy"
        @update:model-value="onName"
      />
    </template>
  </FormField>
  <FormField :label="$t('roles-form-description')" :hint="$t('roles-form-description-hint')">
    <template #default="field">
      <Textarea
        :id="field.id"
        :model-value="props.description"
        name="description"
        :described-by="field.describedBy"
        :disabled="props.busy"
        @update:model-value="onDescription"
      />
    </template>
  </FormField>
  <FormSection :title="$t('roles-form-permissions')">
    <PermissionsPicker
      :model-value="props.permissions"
      :disabled="props.busy"
      :readonly="props.readonly"
      @update:model-value="onPermissions"
    />
  </FormSection>
</template>
