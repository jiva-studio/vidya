<script setup lang="ts">
import type { RoleId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { FormFooter, Label, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { RoleRow } from '@/entities/role'
import { roleApi } from '@/entities/role'
import { useSchoolApi } from '@/entities/school'
import { useCan } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { reasonOf, useToasts } from '@/shared/lib'
import { PageBack } from '@/shared/navigation'

import DefaultRoleField from './DefaultRoleField.vue'
import SchoolAboutField from './SchoolAboutField.vue'
import SchoolLogoField from './SchoolLogoField.vue'
import SchoolNameField from './SchoolNameField.vue'
import StudentRolesList from './StudentRolesList.vue'
import { formClasses, pageClasses } from './styles'
import type { SchoolFormPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SchoolFormPageProps>(), { id: undefined })

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const router = useRouter()
const toasts = useToasts()
const api = useSchoolApi()
const roles = roleApi(useHttp())

const canManageOrg = useCan('schools:create')
const isSettingsPage = computed(() => route.name === 'school-settings')

const name = ref('')
const logoUrl = ref('')
const description = ref('')
const defaultStudentRoleId = ref('')
const studentRoleIds = ref<RoleId[]>([])
const availableRoles = ref<RoleRow[]>([])

const busy = ref(false)
const error = ref<string | undefined>(undefined)
const invalid = ref(false)
const badLogo = ref(false)

const title = computed(() => {
  if (isSettingsPage.value) return $t('nav-school-settings')
  return props.id ? $t('schools-form-edit-title') : $t('schools-form-create-title')
})
const nameError = computed(() => (invalid.value ? $t('schools-form-name-required') : undefined))
const logoError = computed(() => (badLogo.value ? $t('schools-form-logo-invalid') : undefined))

// Only users with org-level school management rights can edit the school name;
// school-level admins see it as disabled.
const nameDisabled = computed(() => busy.value || (Boolean(props.id) && !canManageOrg.value))

const roleOptions = computed<SelectOption[]>(() =>
  availableRoles.value.map((role) => ({ value: role.id, label: role.name })),
)
const chosenStudentRoles = computed(() => new Set<RoleId>(studentRoleIds.value))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

function onToggleRole(roleId: RoleId, checked: boolean) {
  studentRoleIds.value = checked
    ? [...studentRoleIds.value, roleId]
    : studentRoleIds.value.filter((held) => held !== roleId)
}

async function onSubmit() {
  invalid.value = name.value.trim().length === 0
  badLogo.value = !isAddressable(logoUrl.value)
  if (invalid.value || badLogo.value) return

  busy.value = true
  error.value = undefined

  try {
    await send()
    toasts.show({ title: $t('toast-saved'), tone: 'success' })
    if (isSettingsPage.value) {
      await load()
    } else {
      void router.push({ name: 'schools' })
    }
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

function onCancel() {
  if (isSettingsPage.value) {
    void load()
  } else {
    void router.push({ name: 'schools' })
  }
}

/* -------------------------------- Helpers --------------------------------- */

async function load(): Promise<void> {
  const id = props.id
  if (!id) return

  busy.value = true
  try {
    const [school, configs, rolesList] = await Promise.all([
      api.get(id),
      api.configs(id).catch(() => ({ defaultStudentRoleId: undefined, studentRoleIds: [] })),
      roles.list(id).catch(() => ({ items: [] })),
    ])

    name.value = school.name
    logoUrl.value = school.logoUrl ?? ''
    description.value = school.description ?? ''

    defaultStudentRoleId.value = configs.defaultStudentRoleId ?? ''
    studentRoleIds.value = configs.studentRoleIds ?? []
    availableRoles.value = rolesList.items
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

function filled(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isAddressable(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return true
  if (trimmed.startsWith('/media/')) return true

  return URL.canParse(trimmed) && /^https?:$/.test(new URL(trimmed).protocol)
}

function chosenDefaultRole(): RoleId | undefined {
  return defaultStudentRoleId.value ? asId<RoleId>(defaultStudentRoleId.value) : undefined
}

async function send(): Promise<void> {
  const body = {
    name: name.value.trim(),
    logoUrl: filled(logoUrl.value),
    description: filled(description.value),
  }

  if (props.id) {
    await Promise.all([
      api.update(props.id, body),
      api.saveConfigs(props.id, {
        defaultStudentRoleId: chosenDefaultRole(),
        studentRoleIds: studentRoleIds.value,
      }),
    ])
    return
  }

  await api.create(body)
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="title">
      <template #leading><PageBack /></template>
    </PageHeader>
    <form :class="formClasses" @submit.prevent="onSubmit">
      <SchoolNameField v-model="name" :error="nameError" :disabled="nameDisabled" />
      <SchoolAboutField v-model="description" :disabled="busy" />
      <SchoolLogoField v-model="logoUrl" :error="logoError" :disabled="busy" />

      <!-- Role settings (available when editing existing school) -->
      <DefaultRoleField
        v-if="props.id && availableRoles.length > 0"
        v-model="defaultStudentRoleId"
        :options="roleOptions"
        :disabled="busy"
      />
      <div v-if="props.id && availableRoles.length > 0" class="flex flex-col gap-2">
        <Label>{{ $t('schools-settings-student-roles') }}</Label>
        <StudentRolesList
          :roles="availableRoles"
          :chosen="[...chosenStudentRoles]"
          :disabled="busy"
          @toggle="onToggleRole"
        />
      </div>

      <FormFooter
        :submit-label="$t('action-save')"
        :cancel-label="$t('action-cancel')"
        :busy="busy"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </form>
  </section>
</template>
