<script setup lang="ts">
import type { RoleId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import {
  Checkbox,
  EmptyState,
  ErrorState,
  FormActions,
  FormField,
  FormSection,
  PageHeader,
  Select,
  Skeleton,
} from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { RoleRow } from '@/entities/role'
import { roleApi } from '@/entities/role'
import { reasonOf } from '@/shared/lib'
import { useSchoolApi } from '@/entities/school'
import { useHttp } from '@/shared/api'

import type { SchoolSettingsPageProps } from './types'
import { formClasses, listClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolSettingsPageProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const schools = useSchoolApi()

// The settings belong to the school in the address, which need not be the one
// the switcher is on, so the roles are asked for that school by name.
const roles = roleApi(useHttp())

const available = ref<RoleRow[]>([])
const defaultStudentRoleId = ref('')
const studentRoleIds = ref<RoleId[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref<string | undefined>(undefined)

const options = computed<SelectOption[]>(() =>
  available.value.map((role) => ({ value: role.id, label: role.name })),
)
const chosen = computed(() => new Set<RoleId>(studentRoleIds.value))
const errorText = computed(() => (error.value ? $t(error.value) : undefined))
const loadFailed = computed(() => Boolean(error.value) && available.value.length === 0)

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  void load()
}

function onToggle(roleId: RoleId, checked: boolean) {
  studentRoleIds.value = checked
    ? [...studentRoleIds.value, roleId]
    : studentRoleIds.value.filter((held) => held !== roleId)
}

async function onSubmit() {
  busy.value = true
  error.value = undefined

  try {
    await schools.saveConfigs(props.id, {
      defaultStudentRoleId: chosenDefaultRole(),
      studentRoleIds: studentRoleIds.value,
    })
    void router.push({ name: 'schools' })
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

function onCancel() {
  void router.push({ name: 'schools' })
}

/* -------------------------------- Helpers --------------------------------- */

// The select works in plain strings; the brand is put back on at the boundary.
function chosenDefaultRole(): RoleId | undefined {
  return defaultStudentRoleId.value ? asId<RoleId>(defaultStudentRoleId.value) : undefined
}

async function load(): Promise<void> {
  loading.value = true
  error.value = undefined
  available.value = []

  try {
    const [configs, list] = await Promise.all([schools.configs(props.id), roles.list(props.id)])
    defaultStudentRoleId.value = configs.defaultStudentRoleId ?? ''
    studentRoleIds.value = configs.studentRoleIds ?? []
    available.value = list.items
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PageHeader
    :title="$t('schools-settings-title')"
    :description="$t('schools-settings-description')"
  />
  <Skeleton v-if="loading" shape="block" :lines="4" />
  <ErrorState
    v-else-if="loadFailed"
    :description="errorText ?? $t('state-error')"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
  />
  <EmptyState
    v-else-if="available.length === 0"
    :title="$t('schools-settings-empty-title')"
    :description="$t('schools-settings-empty-body')"
  />
  <form v-else :class="formClasses" @submit.prevent="onSubmit">
    <FormField
      :label="$t('schools-settings-default-role')"
      :hint="$t('schools-settings-default-role-hint')"
    >
      <template #default="field">
        <Select
          :id="field.id"
          v-model="defaultStudentRoleId"
          :options="options"
          :placeholder="$t('schools-settings-default-role-none')"
          :described-by="field.describedBy"
        />
      </template>
    </FormField>
    <FormSection :title="$t('schools-settings-student-roles')">
      <div :class="listClasses">
        <Checkbox
          v-for="role in available"
          :key="role.id"
          :model-value="chosen.has(role.id)"
          :label="role.name"
          :disabled="busy"
          @update:model-value="onToggle(role.id, $event)"
        />
      </div>
    </FormSection>
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
