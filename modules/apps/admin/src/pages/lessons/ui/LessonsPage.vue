<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Breadcrumbs, Button, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCourseLessons } from '@/entities/lesson'
import { useCan } from '@/shared/access'

import AddLessonDialog from './AddLessonDialog.vue'
import LessonsTable from './LessonsTable.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const router = useRouter()

const courseId = asId<CourseId>(String(route.params.courseId ?? ''))
const lessons = useCourseLessons(courseId)

const canCreate = useCan('lessons:create')
const canEdit = useCan('lessons:update')

const adding = ref(false)
const busy = ref(false)

const breadcrumbs = computed(() => [
  { key: 'courses', label: $t('courses-title') },
  { key: 'lessons', label: $t('lessons-title') },
])

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb(key: string) {
  if (key === 'courses') void router.push({ name: 'courses' })
}

function onCreate() {
  adding.value = true
}

function onDialog(open: boolean) {
  adding.value = open
}

async function onAdd(title: string) {
  busy.value = true
  const added = await lessons.add(title)
  busy.value = false
  if (added) adding.value = false
}

// The editor is another section's screen, reached by the name of its route so
// that this one never has to know where it lives or what it is made of.
function onEdit(id: string) {
  void router.push({ name: 'lesson-editor', params: { courseId, lessonId: id } })
}

function onBack() {
  void router.push({ name: 'courses' })
}

function onRetry() {
  void lessons.reload()
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('lessons-title')">
      <template #breadcrumbs>
        <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
      </template>
      <template #actions>
        <Button variant="ghost" @click="onBack">{{ $t('lessons-back') }}</Button>
        <Button v-if="canCreate" @click="onCreate">{{ $t('lessons-add') }}</Button>
      </template>
    </PageHeader>
    <LessonsTable
      :rows="lessons.rows.value"
      :loading="lessons.loading.value"
      :error="lessons.error.value ? $t('state-error') : undefined"
      :can-create="canCreate"
      :can-edit="canEdit"
      @retry="onRetry"
      @create="onCreate"
      @edit="onEdit"
    />
    <AddLessonDialog
      :open="adding"
      :busy="busy"
      :error="lessons.addError.value && $t(lessons.addError.value)"
      @update:open="onDialog"
      @submit="onAdd"
    />
  </section>
</template>
