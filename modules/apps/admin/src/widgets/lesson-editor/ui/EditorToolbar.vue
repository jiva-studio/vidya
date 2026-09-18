<script setup lang="ts">
import { Badge, Button, PageHeader } from '@vidya/ui'
import { computed } from 'vue'

import { toolbarActionsClasses, toolbarErrorClasses, toolbarFactsClasses } from './styles'
import type { EditorToolbarEmits, EditorToolbarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EditorToolbarProps>(), {
  title: undefined,
  version: undefined,
  frozen: false,
  dirty: false,
  saving: false,
  busy: false,
  canPublish: false,
  blocked: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EditorToolbarEmits>()

/* --------------------------------- State ---------------------------------- */

const stateTone = computed(() => (props.frozen ? 'success' : 'warning'))
const stateKey = computed(() => (props.frozen ? 'editor-state-published' : 'editor-state-draft'))

/* -------------------------------- Handlers -------------------------------- */

function onBack() {
  emit('back')
}

function onSave() {
  emit('save')
}

function onPublish() {
  emit('publish')
}

function onRevision() {
  emit('revision')
}
</script>

<template>
  <PageHeader :title="props.title ?? $t('editor-title')" :description="$t('editor-subtitle')">
    <template #actions>
      <span :class="toolbarFactsClasses">
        <Badge v-if="props.version" :tone="stateTone">
          {{ $t(stateKey, { version: props.version }) }}
        </Badge>
        <Badge v-if="props.dirty" tone="info">{{ $t('editor-unsaved') }}</Badge>
      </span>
      <span :class="toolbarActionsClasses">
        <Button variant="ghost" @click="onBack">{{ $t('editor-back') }}</Button>
        <Button v-if="props.frozen" :busy="props.busy" @click="onRevision">
          {{ $t('editor-new-revision') }}
        </Button>
        <Button v-if="!props.frozen" :busy="props.saving" :disabled="props.blocked" @click="onSave">
          {{ $t('editor-save') }}
        </Button>
        <Button
          v-if="!props.frozen && props.canPublish"
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
