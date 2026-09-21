<script setup lang="ts">
import { computed, inject } from 'vue'

import { embedSrc, mediaSrc } from '../../lib/blockUrls'
import { mediaResolverKey } from '../../lib/mediaResolver'
import { frameClasses, missingClasses, playerClasses } from './styles'
import type { MediaPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const resolveUpload = inject(mediaResolverKey, undefined)

// Both are `undefined` unless the URL passed the check, so a refused link
// renders as a message rather than as a frame pointed at whatever it said.
const embed = computed(() => embedSrc(props.block.source, props.block.url))

const direct = computed(() =>
  props.block.source === 'upload'
    ? resolveUpload?.(props.block.url)
    : mediaSrc(props.block.source, props.block.url),
)

const isVideo = computed(() => props.block.type === 'video')
</script>

<template>
  <iframe
    v-if="embed"
    :src="embed"
    :class="frameClasses"
    :title="props.labels.embeddedMedia"
    sandbox="allow-scripts allow-same-origin allow-presentation"
    referrerpolicy="no-referrer"
    allowfullscreen
  />
  <video v-else-if="direct && isVideo" :src="direct" :class="playerClasses" controls />
  <audio v-else-if="direct" :src="direct" :class="playerClasses" controls />
  <p v-else :class="missingClasses">{{ props.labels.missingMedia }}</p>
</template>
