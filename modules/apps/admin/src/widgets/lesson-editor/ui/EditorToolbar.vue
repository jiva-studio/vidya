<script setup lang="ts">
import { Badge, Breadcrumbs, Button, PageHeader, Tabs } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { toolbarActionsClasses, toolbarErrorClasses, toolbarFactsClasses } from './styles'
import type { EditorMode, EditorToolbarEmits, EditorToolbarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EditorToolbarProps>(), {
  title: undefined,
  version: undefined,
  mode: 'write',
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

const stateTone = computed(() => (props.frozen ? 'success' : 'warning'))
const saveTone = computed(() => (props.status === 'failed' ? 'danger' : 'info'))
const saveKey = computed(() => `editor-status-${props.status}`)
const reporting = computed(() => props.status !== 'idle')
const failed = computed(() => props.status === 'failed')
const saving = computed(() => props.status === 'saving')
const stateKey = computed(() => (props.frozen ? 'editor-state-published' : 'editor-state-draft'))

const breadcrumbs = computed(() => [
  { key: 'courses', label: $t('courses-title') || $t('nav-courses') || 'Courses' },
  { key: 'lessons', label: $t('lessons-title') || 'Lessons' },
  { key: 'current', label: props.title ?? $t('editor-title') },
])

const modes = computed(() => [
  { value: 'write', label: $t('editor-mode-write') },
  { value: 'read', label: $t('editor-mode-read') },
])

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb(key: string) {
  if (key === 'courses' || key === 'lessons') {
    emit('back')
  }
}

function onMode(mode: string) {
  emit('update:mode', mode as EditorMode)
}

function onBack() {
  emit('back')
}

function onSave() {
  emit('save')
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
      <Tabs
        :model-value="props.mode"
        :items="modes"
        variant="segmented"
        :label="$t('editor-mode-label')"
        @update:model-value="onMode"
      />
      <span :class="toolbarFactsClasses">
        <Badge v-if="props.version" :tone="stateTone">
          {{ $t(stateKey, { version: props.version }) }}
        </Badge>
        <Badge v-if="props.dirty" tone="info">{{ $t('editor-unsaved') }}</Badge>
        <Badge v-if="reporting" :tone="saveTone">{{ $t(saveKey) }}</Badge>
      </span>
      <span :class="toolbarActionsClasses">
        <Button variant="ghost" @click="onBack">{{ $t('editor-back') }}</Button>
        <Button v-if="props.frozen" :busy="props.busy" @click="onRevision">
          {{ $t('editor-new-revision') }}
        </Button>
        <Button v-if="!props.frozen" :busy="saving" :disabled="props.blocked" @click="onSave">
          {{ $t('editor-save') }}
        </Button>
        <Button v-if="failed" variant="ghost" @click="onRetry">
          {{ $t('editor-save-retry') }}
        </Button>
        <Button
          v-if="!props.frozen && props.publishable"
          variant="secondary"
          :disabled="props.blocked"
          @click="onPublish"
        >
          {{ $t('editor-publish') }}
        </Button>
      </span>
      <span v-if="props.error" :class="toolbarErrorClasses" role="alert">{{ props.error }}</span>
    </template>
  </PageHeader>
</template>
