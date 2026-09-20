<script setup lang="ts">
import MediaBlockEditor from './MediaBlockEditor.vue'
import type { MediaBlock, AudioBlockEditorEmits, AudioBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AudioBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AudioBlockEditorEmits>()

/* -------------------------------- Handlers -------------------------------- */

// The shell speaks the union; only this block's own kind can come back out of it.
function onUpdate(block: MediaBlock) {
  emit('update', block as AudioBlockEditorProps['block'])
}
</script>

<template>
  <MediaBlockEditor :block="props.block" kind="audio" :frozen="props.frozen" @update="onUpdate" />
</template>
