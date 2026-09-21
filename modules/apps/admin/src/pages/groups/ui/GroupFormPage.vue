<script setup lang="ts">
import { useFluent } from 'fluent-vue'
import type { GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { FailureState, PageHeader, Skeleton } from '@vidya/ui'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useGroupForm } from '@/entities/group'

import GroupForm from './GroupForm.vue'
import { formLoadingClasses, pageClasses } from './styles'
import { PageBack } from '@/widgets/page-back'
import { useToasts } from '@/shared/lib'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const { $t } = useFluent()
const router = useRouter()
const toasts = useToasts()

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
  if (!(await form.save())) return

  toasts.show({ title: $t('toast-saved'), tone: 'success' })
  void router.push({ name: 'groups' })
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
    <PageHeader :title="$t(title)">
      <template #leading><PageBack /></template>
    </PageHeader>
    <div v-if="form.loading.value" :class="formLoadingClasses">
      <Skeleton shape="text" :lines="2" />
      <Skeleton shape="block" :lines="4" />
    </div>
    <FailureState
      v-else-if="loadFailed"
      :title="$t('state-error-title')"
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
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </section>
</template>
