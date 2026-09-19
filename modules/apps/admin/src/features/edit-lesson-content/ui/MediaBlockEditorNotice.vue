<script setup lang="ts">
import { Button } from '@vidya/ui'

import { mediaAlertClasses, mediaRowClasses } from './MediaBlockEditor.styles'
import type {
  MediaBlockEditorNoticeEmits,
  MediaBlockEditorNoticeProps,
} from './MediaBlockEditor.types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaBlockEditorNoticeProps>(), { retryLabel: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaBlockEditorNoticeEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
}
</script>

<template>
  <div :class="mediaRowClasses">
    <p :class="mediaAlertClasses" role="alert">{{ props.message }}</p>
    <Button v-if="props.retryLabel" variant="secondary" @click="onRetry">
      {{ props.retryLabel }}
    </Button>
  </div>
</template>
