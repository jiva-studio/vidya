<script setup lang="ts">
import { FieldGroup, FormField, Input } from '@vidya/ui'

import type { UserFormValues } from '@/entities/user'

import type { UserDetailsFormEmits, UserDetailsFormProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<UserDetailsFormProps>(), {
  busy: false,
  invalid: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<UserDetailsFormEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onName(name: string) {
  patch({ name })
}

function onEmail(email: string) {
  patch({ email })
}

/* -------------------------------- Helpers --------------------------------- */

function patch(values: Partial<UserFormValues>) {
  emit('update:modelValue', { ...props.modelValue, ...values })
}
</script>

<template>
  <FieldGroup :title="$t('users-form-title')">
    <FormField
      :label="$t('users-form-name')"
      :error="props.invalid ? $t('users-form-name-required') : undefined"
      required
    >
      <template #default="field">
        <Input
          :id="field.id"
          name="name"
          :model-value="props.modelValue.name"
          :disabled="props.busy"
          :invalid="field.invalid"
          @update:model-value="onName"
        />
      </template>
    </FormField>
    <FormField :label="$t('users-form-email')">
      <template #default="field">
        <Input
          :id="field.id"
          name="email"
          :model-value="props.modelValue.email"
          type="email"
          :disabled="props.busy"
          @update:model-value="onEmail"
        />
      </template>
    </FormField>
  </FieldGroup>
</template>
