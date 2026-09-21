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

// One word, where three coloured pills used to be: what is happening to the
// draft, or — while nothing is — whether what is open is what students read.
const state = computed(() =>
  props.status === 'idle'
    ? $t(props.frozen ? 'editor-state-published' : 'editor-state-draft')
    : $t(`editor-status-${props.status}`),
)

// Which snapshot is on screen. Saving a published one writes the next number,
// so the author needs to see the number to know which is which.
const versionLabel = computed(() =>
  props.version === undefined ? undefined : $t('editor-version', { version: props.version }),
)

// The document saves itself, and the word above says so; the button is for
// whoever wants it now, and it says plainly when there is nothing to send.
const savable = computed(() => props.dirty || failed.value)

// A frozen version is what students already read; there is nothing to publish
// until an edit has forked the next draft.
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
