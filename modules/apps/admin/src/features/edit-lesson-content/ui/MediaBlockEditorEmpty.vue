<script setup lang="ts">
import { Button, Dropzone, FormField, Input } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { mediaHiddenInputClasses, mediaRowClasses } from './MediaBlockEditor.styles'
import type {
  MediaBlockEditorEmptyEmits,
  MediaBlockEditorEmptyProps,
} from './MediaBlockEditor.types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaBlockEditorEmptyProps>(), {
  frozen: false,
  source: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaBlockEditorEmptyEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const refusedLabel = computed(() => $t(`editor-media-refused-${props.kind}`))
const hint = computed(() => $t(`editor-media-drop-hint-${props.kind}`))
const linkable = computed(() => Boolean(props.source) && !props.frozen)

/* -------------------------------- Handlers -------------------------------- */

function onFiles(files: File[]) {
  emit('files', files)
}

function onRefused() {
  emit('refused')
}

// `Dropzone` opens the browser's file dialog through an input it never puts in
// the document, so the block keeps its own: the types it accepts have to be on
// an element a screen reader — and a test — can actually reach.
function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('files', [...(input.files ?? [])])
}

function onLibrary() {
  emit('library')
}

function onLink(value: string) {
  emit('update:link', value)
}

function onSubmit() {
  emit('submit')
}
</script>

<template>
  <div :class="mediaRowClasses">
    <Dropzone
      :accept="props.accept"
      :label="$t('editor-media-drop-label')"
      :hint="hint"
      :browse-label="$t('editor-media-browse')"
      :refused-label="refusedLabel"
      :disabled="props.frozen"
      @files="onFiles"
      @refused="onRefused"
    />
    <input
      type="file"
      :accept="props.accept"
      :disabled="props.frozen"
      :class="mediaHiddenInputClasses"
      :aria-label="$t('editor-media-browse')"
      @change="onChange"
    />
    <Button variant="secondary" :disabled="props.frozen" @click="onLibrary">
      {{ $t('editor-media-library') }}
    </Button>
    <FormField :label="$t('editor-media-link-label')" :hint="$t('editor-media-link-hint')">
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.link"
          :described-by="field.describedBy"
          :readonly="props.frozen"
          inputmode="url"
          placeholder="https://"
          @update:model-value="onLink"
        />
      </template>
    </FormField>
    <Button variant="secondary" :disabled="!linkable" @click="onSubmit">
      {{ $t('media-picker-link-submit') }}
    </Button>
  </div>
</template>
