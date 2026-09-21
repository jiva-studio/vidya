<script setup lang="ts">
import { Button, Input, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { titleClasses, toolbarErrorClasses, toolbarVersionClasses } from './styles'
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
const saving = computed(() => props.status === 'saving')

// The button is the status. A word beside it saying the same thing is a second
// place to read, and the two disagreed as often as they agreed.
const saveLabel = computed(() => {
  if (saving.value) return $t('editor-status-saving')
  if (failed.value) return $t('editor-save-retry')
  return $t(props.dirty ? 'editor-save' : 'editor-status-saved')
})

// Saving a published version writes the next number, so the number is shown,
// and whether what is open is the one students read.
const versionLabel = computed(() => {
  if (props.version === undefined) return undefined
  const key = props.frozen ? 'editor-version-published' : 'editor-version'
  return $t(key, { version: props.version })
})

// `blocked` is content this build cannot author, so the save is refused and
// the button must not offer it. A frozen version is not blocked: saving forks.
const savable = computed(() => !props.blocked && (props.dirty || failed.value))

// Nothing to publish until an edit has forked the next draft.
const canPublish = computed(() => props.publishable && !props.frozen)

/* -------------------------------- Handlers -------------------------------- */

function onTitle(title: string) {
  emit('rename', title)
}

function onSave() {
  if (failed.value) return emit('retry')
  emit('save')
}

function onPublish() {
  emit('publish')
}
</script>

<template>
  <PageHeader :title="props.title ?? $t('editor-title')">
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
      <Button
        variant="secondary"
        :disabled="!savable"
        :busy="saving"
        :busy-label="saveLabel"
        @click="onSave"
      >
        {{ saveLabel }}
      </Button>
      <Button v-if="canPublish" :disabled="props.blocked" @click="onPublish">
        {{ $t('editor-publish') }}
      </Button>
      <span v-if="props.error" :class="toolbarErrorClasses" role="alert">{{ props.error }}</span>
    </template>
  </PageHeader>
</template>
