<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { FormActions, FormField, FormSection, Input, PageHeader, Textarea } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { PermissionsPicker, reason, useRoleApi } from '@/entities/role'
import { useCurrentSchool } from '@/shared/access'

import { formClasses } from './styles'
import type { RoleFormPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<RoleFormPageProps>(), { id: undefined })

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const api = useRoleApi()

// Read when the request is built, never captured: a role created after the
// switcher moved must belong to the school on screen, not the one loaded with.
const { schoolId } = useCurrentSchool()

const name = ref('')
const description = ref('')
const permissions = ref<PermissionKey[]>([])
const busy = ref(false)
const error = ref<string | undefined>(undefined)
const invalid = ref(false)

const title = computed(() =>
  props.id ? $t('roles-form-edit-title') : $t('roles-form-create-title'),
)
// Creating a role needs a school to create it in; editing one does not.
const canSubmit = computed(() => Boolean(props.id) || Boolean(schoolId.value))
const nameError = computed(() => (invalid.value ? $t('roles-form-name-required') : undefined))
const errorText = computed(() => (error.value ? $t(error.value) : undefined))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

async function onSubmit() {
  invalid.value = name.value.trim().length === 0
  if (invalid.value) return

  busy.value = true
  error.value = undefined

  try {
    await send()
    void router.push({ name: 'roles' })
  } catch (failure) {
    error.value = reason(failure)
  } finally {
    busy.value = false
  }
}

function onCancel() {
  void router.push({ name: 'roles' })
}

/* -------------------------------- Helpers --------------------------------- */

async function load(): Promise<void> {
  const id = props.id
  if (!id) return

  busy.value = true
  try {
    const role = await api.get(id)
    name.value = role.name
    description.value = role.description
    permissions.value = role.permissions
  } catch (failure) {
    error.value = reason(failure)
  } finally {
    busy.value = false
  }
}

async function send(): Promise<void> {
  const body = {
    name: name.value.trim(),
    description: description.value.trim(),
    permissions: permissions.value,
  }

  if (props.id) {
    await api.update(props.id, body)
    return
  }

  const school = schoolId.value
  if (!school) return

  await api.create({ ...body, schoolId: school })
}
</script>

<template>
  <PageHeader :title="title" />
  <form :class="formClasses" @submit.prevent="onSubmit">
    <FormField
      :label="$t('roles-form-name')"
      :hint="$t('roles-form-name-hint')"
      :error="nameError"
      required
    >
      <template #default="field">
        <Input
          :id="field.id"
          v-model="name"
          name="name"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          :disabled="busy"
        />
      </template>
    </FormField>
    <FormField :label="$t('roles-form-description')" :hint="$t('roles-form-description-hint')">
      <template #default="field">
        <Textarea
          :id="field.id"
          v-model="description"
          name="description"
          :described-by="field.describedBy"
          :disabled="busy"
        />
      </template>
    </FormField>
    <FormSection :title="$t('roles-form-permissions')">
      <PermissionsPicker v-model="permissions" :disabled="busy" />
    </FormSection>
    <FormActions
      :submit-label="$t('action-save')"
      :cancel-label="$t('action-cancel')"
      :busy="busy"
      :disabled="!canSubmit"
      :error="errorText"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </form>
</template>
