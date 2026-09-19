<script setup lang="ts">
import { computed } from 'vue'

import { useMediaGateway } from '@/entities/media'
import { embedSrc, mediaSrc } from '@/features/edit-lesson-content'

import { frameClasses, mutedClasses, playerClasses } from './styles'
import type { MediaPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const gateway = useMediaGateway()

// Both are `undefined` unless the URL passed the model's check, so a refused
// link renders as a message rather than as a frame pointed at whatever it said.
const embed = computed(() => embedSrc(props.block.source, props.block.url))

// An uploaded file is stored under a path only the gateway can answer. Handing
// that path to a player would have the dev server answer with the app's own
// HTML, which renders as a broken file rather than as a missing one.
const direct = computed(() =>
  props.block.source === 'upload'
    ? gateway.resolve(props.block.url)
    : mediaSrc(props.block.source, props.block.url),
)

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
