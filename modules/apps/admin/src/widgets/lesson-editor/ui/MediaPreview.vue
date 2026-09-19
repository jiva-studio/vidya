<script setup lang="ts">
import { computed } from 'vue'

import { embedSrc, mediaSrc } from '@/features/edit-lesson-content'

import { frameClasses, mutedClasses, playerClasses } from './styles'
import type { MediaPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaPreviewProps>()

/* --------------------------------- State ---------------------------------- */

// Both are `undefined` unless the URL passed the model's check, so a refused
// link renders as a message rather than as a frame pointed at whatever it said.
const embed = computed(() => embedSrc(props.block.source, props.block.url))
const direct = computed(() => mediaSrc(props.block.source, props.block.url))

const isVideo = computed(() => props.block.type === 'video')
</script>

<template>
  <iframe
    v-if="embed"
    :src="embed"
    :class="frameClasses"
    :title="$t('editor-preview-embed-title')"
    sandbox="allow-scripts allow-same-origin allow-presentation"
    referrerpolicy="no-referrer"
    allowfullscreen
  />
  <video v-else-if="direct && isVideo" :src="direct" :class="playerClasses" controls />
  <audio v-else-if="direct" :src="direct" :class="playerClasses" controls />
  <p v-else :class="mutedClasses">{{ $t('editor-preview-media-missing') }}</p>
</template>
