<script setup lang="ts">
import type { GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ErrorState, PageHeader, Skeleton } from '@vidya/ui'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useGroupForm } from '@/entities/group'

import GroupForm from './GroupForm.vue'
import { formLoadingClasses, pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()

const groupId = idFromRoute()
const form = useGroupForm(groupId)
const courses = useCourses()

const editing = computed(() => groupId !== undefined)
const title = computed(() => (editing.value ? 'group-form-edit-title' : 'group-form-create-title'))

const options = computed(() =>
  courses.items.value.map((course) => ({ value: course.id, label: course.name })),
)

const loadFailed = computed(() => editing.value && !form.loading.value && form.error.value)

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  void form.load()
})

/* -------------------------------- Handlers -------------------------------- */

async function onSubmit() {
  if (await form.save()) void router.push({ name: 'groups' })
}

function onCancel() {
  void router.push({ name: 'groups' })
}

function onRetry() {
  void form.load()
}

/* -------------------------------- Helpers --------------------------------- */

function idFromRoute(): GroupId | undefined {
  const value = route.params.groupId
  return typeof value === 'string' && value.length > 0 ? asId<GroupId>(value) : undefined
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t(title)" />
    <div v-if="form.loading.value" :class="formLoadingClasses">
      <Skeleton shape="text" :lines="2" />
      <Skeleton shape="block" :lines="4" />
    </div>
    <ErrorState
      :title="$t('state-error-title')"
      v-else-if="loadFailed"
      :description="$t(form.error.value ?? 'group-load-failed')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <GroupForm
      v-else
      v-model="form.values.value"
      :courses="options"
      :course-locked="editing"
      :busy="form.saving.value"
      :error="form.error.value && $t(form.error.value)"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </section>
</template>
