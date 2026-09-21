<script setup lang="ts">
import type { UserDetails } from '@vidya/protocol'
import { Avatar, FailureState, FieldGroup, FormFooter, PageHeader, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'

import type { UserFormValues } from '@/entities/user'
import { useUserApi } from '@/entities/user'
import { UserRolesSelector, useUserRoles } from '@/features/manage-user-roles'
import { useCan } from '@/shared/access'
import { nameOpenPage } from '@/shared/navigation'
import { reasonOf, useToasts } from '@/shared/lib'

import { pageClasses, sectionClasses } from './styles'
import type { UserCardPageProps } from './types'
import UserDetailsForm from './UserDetailsForm.vue'
import UserFacts from './UserFacts.vue'
import { PageBack } from '@/shared/navigation'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserCardPageProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const api = useUserApi()
const toasts = useToasts()
const roles = useUserRoles(() => props.id)

const canUpdate = useCan('users:update')

const user = ref<UserDetails | undefined>(undefined)
const values = ref<UserFormValues>({ name: '', email: '', phone: '' })
const loading = ref(false)
const saving = ref(false)
const invalid = ref(false)
const error = ref<string | undefined>(undefined)

const title = computed(() => user.value?.name ?? $t('users-card-title'))

// The card is one form: the name, the address and the roles go to the server
// together, under the one button, so nothing is half-saved behind the reader.
const dirty = computed(
  () =>
    roles.dirty.value ||
    values.value.name !== (user.value?.name ?? '') ||
    values.value.email !== (user.value?.email ?? ''),
)

/* ---------------------------------- Hooks --------------------------------- */

nameOpenPage(() => user.value?.name)

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  void load()
}

function onValues(next: UserFormValues) {
  values.value = next
  invalid.value = false
}

function onCancel() {
  reset()
  roles.reset()
}

async function onSubmit() {
  invalid.value = values.value.name.trim().length === 0
  if (invalid.value || !user.value) return

  saving.value = true
  error.value = undefined

  try {
    const saved = await api.update(user.value.id, {
      name: values.value.name.trim(),
      email: values.value.email.trim(),
    })
    user.value = { ...user.value, ...saved }
  } catch (failure) {
    error.value = reasonOf(failure)
    return
  } finally {
    saving.value = false
  }

  if (!(await roles.save())) return

  toasts.show({ title: $t('toast-saved'), tone: 'success' })
}

/* -------------------------------- Helpers --------------------------------- */

function reset(): void {
  values.value = {
    name: user.value?.name ?? '',
    email: user.value?.email ?? '',
    phone: user.value?.phone ?? '',
  }
  invalid.value = false
  error.value = undefined
}

async function load(): Promise<void> {
  loading.value = true
  error.value = undefined
  user.value = undefined

  try {
    user.value = await api.get(props.id)
    reset()
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    loading.value = false
  }

  await roles.load()
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="title">
      <template #leading><PageBack /></template>
      <template v-if="user" #actions>
        <Avatar :name="user.name" size="lg" />
      </template>
    </PageHeader>
    <Skeleton v-if="loading" shape="block" :lines="4" />
    <FailureState
      v-else-if="error && !user"
      :title="$t('state-error-title')"
      :description="$t('state-error')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <form v-else-if="user" :class="sectionClasses" novalidate @submit.prevent="onSubmit">
      <UserDetailsForm
        v-if="canUpdate"
        :model-value="values"
        :busy="saving"
        :invalid="invalid"
        @update:model-value="onValues"
      />
      <UserFacts v-else :user="user" />
      <FieldGroup :title="$t('users-roles-title')">
        <UserRolesSelector
          :available="roles.available.value"
          :selected="roles.selected.value"
          :loading="roles.loading.value"
          :error="roles.error.value"
          @toggle="roles.toggle"
          @retry="roles.load"
        />
      </FieldGroup>
      <FormFooter
        v-if="canUpdate"
        :submit-label="$t('action-save')"
        :cancel-label="$t('action-cancel')"
        :busy="saving || roles.saving.value"
        :disabled="!dirty"
        :error="error"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </form>
  </section>
</template>
