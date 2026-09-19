<script setup lang="ts">
import { Breadcrumbs, Button, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { toolbarErrorClasses, toolbarStatusClasses } from './styles'
import type { EditorToolbarEmits, EditorToolbarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EditorToolbarProps>(), {
  title: undefined,
  version: undefined,
  frozen: false,
  dirty: false,
  status: 'idle',
  busy: false,
  publishable: false,
  blocked: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EditorToolbarEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const failed = computed(() => props.status === 'failed')

// One word, where three coloured pills used to be: what is happening to the
// draft, or — while nothing is — which version is open.
const state = computed(() =>
  props.status === 'idle'
    ? $t(props.frozen ? 'editor-state-published' : 'editor-state-draft')
    : $t(`editor-status-${props.status}`),
)

// The path to the lesson. Its name is the heading below, not a crumb as well.
const breadcrumbs = computed(() => [
  { key: 'courses', label: $t('nav-courses') },
  { key: 'lessons', label: $t('lessons-title') },
])

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb() {
  emit('back')
}

function onRetry() {
  emit('retry')
}

function onPublish() {
  emit('publish')
}

function onRevision() {
  emit('revision')
}
</script>

<template>
  <PageHeader :title="props.title ?? $t('editor-title')">
    <template #breadcrumbs>
      <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
    </template>
    <template #actions>
      <span :class="toolbarStatusClasses">{{ state }}</span>
      <Button v-if="failed" variant="ghost" @click="onRetry">{{ $t('editor-save-retry') }}</Button>
      <Button v-if="props.frozen" :busy="props.busy" @click="onRevision">
        {{ $t('editor-new-revision') }}
      </Button>
      <Button
        v-if="!props.frozen && props.publishable"
        :disabled="props.blocked"
        @click="onPublish"
      >
        {{ $t('editor-publish') }}
      </Button>
      <span v-if="props.error" :class="toolbarErrorClasses" role="alert">{{ props.error }}</span>
    </template>
  </PageHeader>
</template>
