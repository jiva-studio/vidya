<script setup lang="ts">
import { embedSrc } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import {
  mediaFrameClasses,
  mediaMutedClasses,
  mediaPlayerClasses,
  mediaRowClasses,
} from './MediaBlockEditor.styles'
import type { MediaBlockEditorFilledProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaBlockEditorFilledProps>(), {
  frozen: false,
  src: undefined,
})

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const embed = computed(() => embedSrc(props.block.source, props.block.url))
const effectiveSrc = computed(() => props.src || props.block.url)
const image = computed(() => effectiveSrc.value && props.kind === 'image')
const video = computed(() => effectiveSrc.value && props.kind === 'video')
const audio = computed(() => effectiveSrc.value && props.kind === 'audio')
const alt = computed(() => $t('editor-media-preview-alt'))
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
    <img v-else-if="image" :src="effectiveSrc" :alt="alt" :class="mediaPlayerClasses" />
    <video v-else-if="video" :src="effectiveSrc" :class="mediaPlayerClasses" controls />
    <audio v-else-if="audio" :src="effectiveSrc" :class="mediaPlayerClasses" controls />
    <p v-else :class="mediaMutedClasses">{{ $t('editor-media-unavailable') }}</p>
  </div>
</template>
