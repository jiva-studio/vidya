<script setup lang="ts">
import type { UserDetails } from '@vidya/protocol'
import {
  Avatar,
  Breadcrumbs,
  ErrorState,
  FormSection,
  PageHeader,
  Separator,
  Skeleton,
} from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { reasonOf } from '@/shared/lib'
import { useUserApi } from '@/entities/user'
import { UserRolesSelector } from '@/features/manage-user-roles'
import { useCan } from '@/shared/access'

import { pageClasses, sectionClasses } from './styles'
import type { UserCardPageProps } from './types'
import UserDetailsForm from './UserDetailsForm.vue'
import UserFacts from './UserFacts.vue'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserCardPageProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const api = useUserApi()

const canUpdate = useCan('users:update')

const user = ref<UserDetails | undefined>(undefined)
const loading = ref(false)
const error = ref<string | undefined>(undefined)

const title = computed(() => user.value?.name ?? $t('users-card-title'))
const errorText = computed(() => (error.value ? $t(error.value) : undefined))
const breadcrumbs = computed(() => [
  { key: 'users', label: $t('users-title') },
  { key: 'current', label: title.value },
])

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  void load()
}

function onBreadcrumb(key: string) {
  if (key === 'users') void router.push({ name: 'users' })
}

/* -------------------------------- Helpers --------------------------------- */

async function load(): Promise<void> {
  loading.value = true
  error.value = undefined
  user.value = undefined

  try {
    user.value = await api.get(props.id)
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="title">
      <template #breadcrumbs>
        <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
      </template>
      <template v-if="user" #actions>
        <Avatar :name="user.name" size="lg" />
      </template>
    </PageHeader>
    <Skeleton v-if="loading" shape="block" :lines="4" />
    <ErrorState
      v-else-if="error"
      :title="$t('state-error-title')"
      :description="errorText ?? $t('state-error')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <div v-else-if="user" :class="sectionClasses">
      <UserDetailsForm v-if="canUpdate" :user="user" />
      <UserFacts v-else :user="user" />
      <Separator />
      <FormSection :title="$t('users-roles-title')">
        <UserRolesSelector :user-id="user.id" />
      </FormSection>
    </div>
  </section>
</template>
