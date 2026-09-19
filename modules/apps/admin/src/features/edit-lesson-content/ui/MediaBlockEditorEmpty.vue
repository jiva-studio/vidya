<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { useFluent } from 'fluent-vue'
import { Image, Music, Video } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { emptyIconClasses, emptyRowClasses } from './MediaBlockEditor.styles'
import type { MediaBlockEditorEmptyEmits, MediaBlockEditorEmptyProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaBlockEditorEmptyProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaBlockEditorEmptyEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const row = ref<HTMLElement | null>(null)
const icons = { image: Image, video: Video, audio: Music }

const icon = computed(() => icons[props.kind])
const label = computed(() => $t(`editor-media-add-${props.kind}`))

// A file may be dropped straight onto the line. Everything else — the library,
// a link, the upload with its progress — is one click away in the dialog, so
// the block stays a line of the document instead of a form inside it.
const { isOverDropZone } = useDropZone(row, { onDrop })

/* -------------------------------- Handlers -------------------------------- */

function onDrop(files: File[] | null) {
  if (props.frozen || !files?.length) return
  emit('files', files)
}

function onOpen() {
  if (!props.frozen) emit('library')
}
</script>

<template>
  <button
    ref="row"
    type="button"
    :class="emptyRowClasses"
    :data-dragging="isOverDropZone || undefined"
    :disabled="props.frozen"
    @click="onOpen"
  >
    <component :is="icon" :class="emptyIconClasses" />
    <span>{{ label }}</span>
  </button>
</template>
