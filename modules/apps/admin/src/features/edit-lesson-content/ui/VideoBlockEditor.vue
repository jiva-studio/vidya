<script setup lang="ts">
import MediaBlockEditor from './MediaBlockEditor.vue'
import type { MediaBlock, VideoBlockEditorEmits, VideoBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<VideoBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<VideoBlockEditorEmits>()

/* -------------------------------- Handlers -------------------------------- */

// The shell speaks the union; only this block's own kind can come back out of it.
function onUpdate(block: MediaBlock) {
  emit('update', block as VideoBlockEditorProps['block'])
}
</script>

<template>
  <MediaBlockEditor :block="props.block" kind="video" :frozen="props.frozen" @update="onUpdate" />
</template>
