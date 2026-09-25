<script setup lang="ts">
import { detectSource, mediaSrc } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { MediaRecord, PickedMedia } from '@/entities/media'
import { useMediaGateway } from '@/entities/media'
import { useToasts } from '@/shared/lib'
import { MediaPickerDialog, useMediaUpload } from '@/features/pick-media'

import { mediaBlockClasses } from './MediaBlockEditor.styles'
import MediaBlockEditorEmpty from './MediaBlockEditorEmpty.vue'
import MediaBlockEditorFilled from './MediaBlockEditorFilled.vue'
import MediaBlockEditorNotice from './MediaBlockEditorNotice.vue'
import MediaBlockEditorProgress from './MediaBlockEditorProgress.vue'
import type { MediaBlockEditorEmits, MediaBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const gateway = useMediaGateway()
const upload = useMediaUpload()

const toasts = useToasts()
const pickerOpen = ref(false)
const link = ref('')
const refused = ref(false)

const accept = computed(() => `${props.kind}/*`)
const linkSource = computed(() => detectSource(link.value))
const uploading = computed(() => upload.status.value === 'uploading')
const filled = computed(() => props.block.url.trim().length > 0)

const notice = computed(() => {
  if (refused.value) return $t(`editor-media-refused-${props.kind}`)
  return upload.error.value ? $t(upload.error.value) : undefined
})

const retryLabel = computed(() =>
  upload.status.value === 'failed' ? $t('editor-media-retry') : undefined,
)

// An uploaded file is addressed by a path only this session can answer, so the
// stored url is never handed to a player directly: the gateway resolves it, and
// a url it has lost renders as a stated absence rather than as a broken frame.
const src = computed(() =>
  props.block.source === 'upload'
    ? gateway.resolve(props.block.url)
    : mediaSrc(props.block.source, props.block.url),
)

/* -------------------------------- Handlers -------------------------------- */

function onFiles(files: File[]) {
  refused.value = false
  void send(files[0])
}

function onLibrary() {
  pickerOpen.value = true
}

function onPicker(open: boolean) {
  pickerOpen.value = open
}

function onLink(value: string) {
  link.value = value
}

function onPick(picked: PickedMedia) {
  apply(picked)
}

function onCancel() {
  upload.cancel()
}

async function onRetry() {
  const record = await upload.retry()
  if (record) store(record)
}

/* -------------------------------- Helpers --------------------------------- */

async function send(file: File | undefined) {
  if (!file) return
  if (!file.type.startsWith(`${props.kind}/`)) {
    refused.value = true
    return
  }

  const record = await upload.start(file)
  if (record) store(record)
}

// A file that arrived through the gateway is stored as an upload: the student
// app plays `upload` and `url` natively and frames everything else.
function store(record: MediaRecord) {
  apply({ url: record.url, source: 'upload', name: record.name })
}

function apply(picked: PickedMedia) {
  refused.value = false
  emit('update', { ...props.block, url: picked.url, source: picked.source })
  if (picked.name) announce(picked.name)
}

function announce(name: string) {
  toasts.show({ title: $t('editor-media-uploaded', { name }), tone: 'success' })
}
</script>

<template>
  <div :class="mediaBlockClasses">
    <MediaBlockEditorProgress v-if="uploading" :percent="upload.percent.value" @cancel="onCancel" />
    <MediaBlockEditorFilled
      v-else-if="filled"
      :block="props.block"
      :kind="props.kind"
      :src="src"
      :frozen="props.frozen"
    />
    <MediaBlockEditorEmpty
      v-else
      :kind="props.kind"
      :frozen="props.frozen"
      @files="onFiles"
      @library="onLibrary"
    />
    <MediaBlockEditorNotice
      v-if="notice"
      :message="notice"
      :retry-label="retryLabel"
      @retry="onRetry"
    />
    <MediaPickerDialog
      :open="pickerOpen"
      :kind="props.kind"
      :accept="accept"
      :link="link"
      :source="linkSource"
      @update:open="onPicker"
      @update:link="onLink"
      @pick="onPick"
    />
  </div>
</template>
