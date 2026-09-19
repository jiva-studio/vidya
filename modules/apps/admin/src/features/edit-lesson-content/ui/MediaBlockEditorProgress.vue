<script setup lang="ts">
import { Button, Progress } from '@vidya/ui'
import { useFluent } from 'fluent-vue'

import { mediaRowClasses } from './MediaBlockEditor.styles'
import type {
  MediaBlockEditorProgressEmits,
  MediaBlockEditorProgressProps,
} from './MediaBlockEditor.types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaBlockEditorProgressProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaBlockEditorProgressEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

/* -------------------------------- Handlers -------------------------------- */

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <div :class="mediaRowClasses">
    <Progress :value="props.percent" :label="$t('editor-media-uploading')" />
    <Button variant="secondary" @click="onCancel">{{ $t('editor-media-cancel') }}</Button>
  </div>
</template>
