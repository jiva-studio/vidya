<script setup lang="ts">
import type { LessonId, LessonVersionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Breadcrumbs, Button, FailureState, PageHeader, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { LessonPreview } from '@/widgets/lesson-editor'
import { useLessonVersionDocument } from '@/widgets/lesson-editor'

import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const router = useRouter()

const lessonId = asId<LessonId>(String(route.params.lessonId ?? ''))
const versionId = asId<LessonVersionId>(String(route.params.versionId ?? ''))

const breadcrumbs = computed(() => [
  { key: 'courses', label: $t('nav-courses') },
  { key: 'current', label: $t('version-title') },
])

// One named version, read and never written: this is where a reviewer arrives
// from a piece of work answered against a version that has since been replaced,
// and what the student read is the whole point of the screen (AC-17).
const document = useLessonVersionDocument(lessonId)

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  void document.open(versionId)
})

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb(key: string) {
  if (key === 'courses') void router.push({ name: 'courses' })
}

function onBack() {
  router.back()
}

function onRetry() {
  void document.open(versionId)
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('version-title')" :description="$t('version-subtitle')">
      <template #breadcrumbs>
        <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
      </template>
      <template #actions>
        <Button variant="ghost" @click="onBack">{{ $t('version-back') }}</Button>
      </template>
    </PageHeader>
    <Skeleton v-if="document.loading.value" shape="block" :lines="6" />
    <FailureState
      v-else-if="document.error.value"
      :title="$t('state-error-title')"
      :description="$t(document.error.value)"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <LessonPreview v-else-if="document.version.value" :content="document.version.value.content" />
  </section>
</template>
