<script setup lang="ts">
import { FormActions, FormField, Input } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import { reasonOf } from '@/shared/lib'
import { useUserApi } from '@/entities/user'

import { formClasses } from './styles'
import type { UserDetailsFormProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserDetailsFormProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const api = useUserApi()

const name = ref(props.user.name)
const email = ref(props.user.email)
const busy = ref(false)
const invalid = ref(false)
const error = ref<string | undefined>(undefined)

const nameError = computed(() => (invalid.value ? $t('users-form-name-required') : undefined))
const errorText = computed(() => (error.value ? $t(error.value) : undefined))

/* -------------------------------- Handlers -------------------------------- */

async function onSubmit() {
  invalid.value = name.value.trim().length === 0
  if (invalid.value) return

  busy.value = true
  error.value = undefined

  try {
    await api.update(props.user.id, {
      name: name.value.trim(),
      email: email.value.trim(),
    })
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

function onCancel() {
  name.value = props.user.name
  email.value = props.user.email
  invalid.value = false
  error.value = undefined
}
</script>

<template>
  <form :class="formClasses" @submit.prevent="onSubmit">
    <FormField
      :label="$t('users-form-name')"
      :error="nameError"
      required
    >
      <template #default="field">
        <Input :id="field.id" v-model="name" name="name" :disabled="busy" />
      </template>
    </FormField>
    <FormField :label="$t('users-form-email')">
      <template #default="field">
        <Input :id="field.id" v-model="email" name="email" type="email" :disabled="busy" />
      </template>
    </FormField>
    <FormActions
      :submit-label="$t('action-save')"
      :cancel-label="$t('action-cancel')"
      :busy="busy"
      :error="errorText"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </form>
</template>
