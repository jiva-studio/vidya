<script setup lang="ts">
import { Button, FormField, Input } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { embedSrc } from '../model/urls'
import {
  mediaFrameClasses,
  mediaMutedClasses,
  mediaPlayerClasses,
  mediaRowClasses,
} from './MediaBlockEditor.styles'
import type { MediaBlockEditorFilledEmits, MediaBlockEditorFilledProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaBlockEditorFilledProps>(), {
  frozen: false,
  src: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaBlockEditorFilledEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const embed = computed(() => embedSrc(props.block.source, props.block.url))
const image = computed(() => props.src && props.kind === 'image')
const video = computed(() => props.src && props.kind === 'video')
const audio = computed(() => props.src && props.kind === 'audio')
const caption = computed(() => props.block.caption ?? '')
const alt = computed(() => caption.value || $t('editor-media-preview-alt'))

/* -------------------------------- Handlers -------------------------------- */

function onCaption(value: string) {
  emit('caption', value)
}

function onReplace() {
  emit('replace')
}
</script>

<template>
  <div :class="mediaRowClasses">
    <iframe
      v-if="embed"
      :src="embed"
      :class="mediaFrameClasses"
      :title="$t('editor-preview-embed-title')"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      referrerpolicy="no-referrer"
      allowfullscreen
    />
    <img v-else-if="image" :src="props.src" :alt="alt" :class="mediaPlayerClasses" />
    <video v-else-if="video" :src="props.src" :class="mediaPlayerClasses" controls />
    <audio v-else-if="audio" :src="props.src" :class="mediaPlayerClasses" controls />
    <p v-else :class="mediaMutedClasses">{{ $t('editor-media-unavailable') }}</p>
    <Button v-if="!props.frozen" variant="secondary" @click="onReplace">
      {{ $t('editor-media-replace') }}
    </Button>
    <FormField :label="$t('editor-media-caption-label')" :hint="$t('editor-media-caption-hint')">
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="caption"
          :described-by="field.describedBy"
          :readonly="props.frozen"
          @update:model-value="onCaption"
        />
      </template>
    </FormField>
  </div>
</template>
