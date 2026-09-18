<script setup lang="ts">
import type { UserDetails } from '@vidya/protocol'
import { ErrorState, FormSection, PageHeader, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'

import { reasonOf } from '@/shared/lib'
import { useUserApi } from '@/entities/user'
import { UserRolesSelector } from '@/features/manage-user-roles'
import { useCan } from '@/shared/access'

import { sectionClasses } from './styles'
import type { UserCardPageProps } from './types'
import UserDetailsForm from './UserDetailsForm.vue'
import UserFacts from './UserFacts.vue'
import UserSchoolsList from './UserSchoolsList.vue'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserCardPageProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const api = useUserApi()

const canUpdate = useCan('users:update')

const user = ref<UserDetails | undefined>(undefined)
const loading = ref(false)
const error = ref<string | undefined>(undefined)

const title = computed(() => user.value?.name ?? $t('users-card-title'))
const errorText = computed(() => (error.value ? $t(error.value) : undefined))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  void load()
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
  <PageHeader :title="title" />
  <Skeleton v-if="loading" shape="block" :lines="4" />
  <ErrorState
    v-else-if="error"
    :description="errorText ?? $t('state-error')"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
  />
  <div v-else-if="user" :class="sectionClasses">
    <UserDetailsForm v-if="canUpdate" :user="user" />
    <UserFacts v-else :user="user" />
    <FormSection :title="$t('users-roles-title')">
      <UserRolesSelector :user-id="user.id" />
    </FormSection>
    <FormSection :title="$t('users-schools-title')">
      <UserSchoolsList :user-id="user.id" />
    </FormSection>
  </div>
</template>
