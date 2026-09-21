<script setup lang="ts">
import { useFluent } from 'fluent-vue'
import type { CourseId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { FailureState, PageHeader, Skeleton } from '@vidya/ui'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCourseForm } from '@/entities/course'

import CourseForm from './CourseForm.vue'
import { formLoadingClasses, pageClasses } from './styles'
import { PageBack } from '@/shared/navigation'
import { useToasts } from '@/shared/lib'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const { $t } = useFluent()
const router = useRouter()
const toasts = useToasts()

const courseId = computed(() => idFromRoute())
const form = useCourseForm(courseId.value)

const editing = computed(() => courseId.value !== undefined)
const title = computed(() =>
  editing.value ? 'course-form-edit-title' : 'course-form-create-title',
)

// A course that could not be read leaves nothing to edit, so the screen offers
// a retry instead of an empty form that would save over what it never loaded.
const loadFailed = computed(() => editing.value && !form.loading.value && form.error.value)

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  void form.load()
})

/* -------------------------------- Handlers -------------------------------- */

async function onSubmit() {
  if (!(await form.save())) return

  toasts.show({ title: $t('toast-saved'), tone: 'success' })
  void router.push({ name: 'courses' })
}

function onCancel() {
  void router.push({ name: 'courses' })
}

function onRetry() {
  void form.load()
}

/* -------------------------------- Helpers --------------------------------- */

function idFromRoute(): CourseId | undefined {
  const value = route.params.courseId
  return typeof value === 'string' && value.length > 0 ? asId<CourseId>(value) : undefined
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
      :description="$t('state-error')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <CourseForm
      v-else
      v-model="form.values.value"
      :busy="form.saving.value"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </section>
</template>
