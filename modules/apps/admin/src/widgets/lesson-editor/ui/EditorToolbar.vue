<script setup lang="ts">
import { Breadcrumbs, Button, Input, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import {
  titleClasses,
  toolbarErrorClasses,
  toolbarStatusClasses,
  toolbarVersionClasses,
} from './styles'
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

// What is happening to the draft, or — while nothing is — what is open.
const state = computed(() =>
  props.status === 'idle'
    ? $t(props.frozen ? 'editor-state-published' : 'editor-state-draft')
    : $t(`editor-status-${props.status}`),
)

// Saving a published version writes the next number, so the number is shown.
const versionLabel = computed(() =>
  props.version === undefined ? undefined : $t('editor-version', { version: props.version }),
)

// `blocked` is content this build cannot author, so the save is refused and
// the button must not offer it. A frozen version is not blocked: saving forks.
const savable = computed(() => !props.blocked && (props.dirty || failed.value))

// Nothing to publish until an edit has forked the next draft.
const canPublish = computed(() => props.publishable && !props.frozen)

// The path to the lesson. Its name is the heading below, not a crumb as well.
const breadcrumbs = computed(() => [
  { key: 'courses', label: $t('nav-courses') },
  { key: 'lessons', label: $t('lessons-title') },
])

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb() {
  emit('back')
}

function onTitle(title: string) {
  emit('rename', title)
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
</script>

<template>
  <PageHeader :title="props.title ?? $t('editor-title')">
    <template #breadcrumbs>
      <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
    </template>
    <template #title>
      <Input
        :class="titleClasses"
        :model-value="props.title ?? ''"
        :placeholder="$t('editor-title-placeholder')"
        :aria-label="$t('editor-title-label')"
        @update:model-value="onTitle"
      />
    </template>
    <template #actions>
      <span v-if="versionLabel" :class="toolbarVersionClasses">{{ versionLabel }}</span>
      <span :class="toolbarStatusClasses">{{ state }}</span>
      <Button v-if="failed" variant="ghost" @click="onRetry">{{ $t('editor-save-retry') }}</Button>
      <Button variant="secondary" :disabled="!savable" @click="onSave">
        {{ $t('editor-save') }}
      </Button>
      <Button v-if="canPublish" :disabled="props.blocked" @click="onPublish">
        {{ $t('editor-publish') }}
      </Button>
      <span v-if="props.error" :class="toolbarErrorClasses" role="alert">{{ props.error }}</span>
    </template>
  </PageHeader>
</template>
