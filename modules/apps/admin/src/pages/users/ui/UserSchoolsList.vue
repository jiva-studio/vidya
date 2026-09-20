<script setup lang="ts">
import type { SchoolId } from '@vidya/domain'
import { Badge, EmptyState, FailureState, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { onMounted, ref } from 'vue'

import { useSchoolApi } from '@/entities/school'
import { reasonOf } from '@/shared/lib'
import { useUserApi } from '@/entities/user'

import { badgesClasses } from './styles'
import type { UserSchoolsListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserSchoolsListProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const users = useUserApi()
const schools = useSchoolApi()

const ids = ref<SchoolId[]>([])
const names = ref(new Map<SchoolId, string>())
const loading = ref(false)
const error = ref<string | undefined>(undefined)

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  void load()
}

/* -------------------------------- Helpers --------------------------------- */

// Only identifiers come back, so the names are resolved once for the screen
// rather than once per line.
async function load(): Promise<void> {
  loading.value = true
  error.value = undefined
  ids.value = []

  try {
    const [mine, all] = await Promise.all([users.schools(props.userId), schools.list()])
    ids.value = mine.userSchools
    names.value = new Map(all.items.map((school) => [school.id, school.name]))
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    loading.value = false
  }
}

function nameOf(id: SchoolId): string {
  return names.value.get(id) ?? $t('school-unnamed', { id })
}
</script>

<template>
  <Skeleton v-if="loading" shape="text" :lines="2" />
  <FailureState
    v-else-if="error"
    :title="$t('state-error-title')"
    :description="$t('state-error')"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
  />
  <EmptyState
    v-else-if="ids.length === 0"
    :title="$t('users-schools-empty-title')"
    :description="$t('users-schools-empty-body')"
  />
  <div v-else :class="badgesClasses">
    <Badge v-for="id in ids" :key="id">{{ nameOf(id) }}</Badge>
  </div>
</template>
