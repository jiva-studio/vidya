<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { FormFooter, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { reasonOf, useToasts } from '@/shared/lib'
import { useRoleApi } from '@/entities/role'
import { useCan, useCurrentSchool } from '@/shared/access'

import RoleFormFields from './RoleFormFields.vue'
import { formClasses, pageClasses } from './styles'
import type { RoleFormPageProps } from './types'
import { PageBack } from '@/shared/navigation'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<RoleFormPageProps>(), { id: undefined })

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const toasts = useToasts()
const api = useRoleApi()

// Read when the request is built, never captured: a role created after the
// switcher moved must belong to the school on screen, not the one loaded with.
const { schoolId } = useCurrentSchool()

const canCreate = useCan('roles:create')
const canUpdate = useCan('roles:update')

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
const canEdit = computed(() => (props.id ? canUpdate.value : canCreate.value))
const nameError = computed(() => (invalid.value ? $t('roles-form-name-required') : undefined))

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
    toasts.show({ title: $t('toast-saved'), tone: 'success' })
    void router.push({ name: 'roles' })
  } catch (failure) {
    error.value = reasonOf(failure)
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
    error.value = reasonOf(failure)
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
  <section :class="pageClasses">
    <PageHeader :title="title">
      <template #leading><PageBack /></template>
    </PageHeader>
    <form :class="formClasses" @submit.prevent="onSubmit">
      <RoleFormFields
        v-model:name="name"
        v-model:description="description"
        v-model:permissions="permissions"
        :name-error="nameError"
        :busy="busy"
        :readonly="!canEdit"
      />
      <FormFooter
        :submit-label="$t('action-save')"
        :cancel-label="$t('action-cancel')"
        :busy="busy"
        :disabled="!canSubmit"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </form>
  </section>
</template>
