<script setup lang="ts">
import { Button, Dropzone, Progress } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import { useMediaUpload } from '../model'
import { hiddenInputClasses, uploadClasses } from './styles'
import type { MediaUploadPanelEmits, MediaUploadPanelProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaUploadPanelProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaUploadPanelEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const upload = useMediaUpload()
const refused = ref(false)

const refusedLabel = computed(() => $t(`editor-media-refused-${props.kind}`))
const hint = computed(() => $t(`editor-media-drop-hint-${props.kind}`))
const uploading = computed(() => upload.status.value === 'uploading')

/* -------------------------------- Handlers -------------------------------- */

async function onFiles(files: File[]) {
  refused.value = false
  await send(files[0])
}

function onRefused() {
  refused.value = true
}

function onChange(event: Event) {
  const [file] = (event.target as HTMLInputElement).files ?? []
  if (file) void onFiles([file])
}

function onCancel() {
  upload.cancel()
}

async function onRetry() {
  const record = await upload.retry()
  if (record) emit('pick', { url: record.url, source: 'upload', name: record.name })
}

/* -------------------------------- Helpers --------------------------------- */

async function send(file: File | undefined) {
  if (!file) return

  const record = await upload.start(file)
  if (record) emit('pick', { url: record.url, source: 'upload', name: record.name })
}
</script>

<template>
  <div :class="uploadClasses">
    <Dropzone
      v-if="!uploading"
      :accept="props.accept"
      :label="$t('media-picker-drop-label')"
      :hint="hint"
      :browse-label="$t('editor-media-browse')"
      :refused-label="refusedLabel"
      @files="onFiles"
      @refused="onRefused"
    />
    <input
      v-if="!uploading"
      type="file"
      :accept="props.accept"
      :class="hiddenInputClasses"
      :aria-label="$t('editor-media-browse')"
      @change="onChange"
    />
    <Progress
      v-if="uploading"
      :value="upload.percent.value"
      :label="$t('editor-media-uploading')"
    />
    <Button v-if="uploading" variant="secondary" @click="onCancel">
      {{ $t('editor-media-cancel') }}
    </Button>
    <p v-if="refused" role="alert">{{ refusedLabel }}</p>
    <p v-if="upload.error.value" role="alert">{{ $t(upload.error.value) }}</p>
    <Button v-if="upload.error.value" variant="secondary" @click="onRetry">
      {{ $t('editor-media-retry') }}
    </Button>
  </div>
</template>
