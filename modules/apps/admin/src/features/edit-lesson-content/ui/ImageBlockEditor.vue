<script setup lang="ts">
import MediaBlockEditor from './MediaBlockEditor.vue'
import type { MediaBlock, ImageBlockEditorEmits, ImageBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ImageBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ImageBlockEditorEmits>()

/* -------------------------------- Handlers -------------------------------- */

// The shell speaks the union; only this block's own kind can come back out of it.
function onUpdate(block: MediaBlock) {
  emit('update', block as ImageBlockEditorProps['block'])
}
</script>

<template>
  <MediaBlockEditor :block="props.block" kind="image" :frozen="props.frozen" @update="onUpdate" />
</template>
