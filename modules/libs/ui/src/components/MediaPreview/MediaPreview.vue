<script setup lang="ts">
import type { AudioBlockState, VideoBlockState } from '@vidya/domain'
import { computed, inject, ref } from 'vue'

import { embedSrc, mediaSrc } from '../../lib/blockUrls'
import { hasMovedOn } from '../../lib/mediaProgress'
import { mediaResolverKey } from '../../lib/mediaResolver'
import { frameClasses, missingClasses, playerClasses } from './styles'
import type { MediaPreviewEmits, MediaPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaPreviewProps>(), { progress: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaPreviewEmits>()

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

const player = ref<HTMLMediaElement>()

const watched = computed(() => {
  const state = props.progress?.states[props.block.id]
  if (state?.type === 'video') return state.watched
  return state?.type === 'audio' ? state.listened : 0
})

// An embed reports no position of its own, and no player API is attached to
// ask it for one: what was watched on YouTube is not recorded at all.
const records = computed(() => props.progress?.editable === true)

let recordedAt = 0

/* -------------------------------- Handlers -------------------------------- */

function onLoadedMetadata() {
  if (player.value === undefined || watched.value === 0) return

  recordedAt = watched.value
  player.value.currentTime = watched.value
}

function onTimeUpdate() {
  const element = player.value
  if (element === undefined || !hasMovedOn(element.currentTime, recordedAt)) return

  recordPosition()
}

function onSettled() {
  recordPosition()
}

/* -------------------------------- Helpers --------------------------------- */

function recordPosition() {
  const element = player.value
  if (element === undefined || !records.value) return

  recordedAt = element.currentTime
  emit('change', positionOf(element))
}

function positionOf(element: HTMLMediaElement): VideoBlockState | AudioBlockState {
  const { currentTime, duration } = element

  return isVideo.value
    ? { type: 'video', watched: currentTime, duration }
    : { type: 'audio', listened: currentTime, duration }
}
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
  <video
    v-else-if="direct && isVideo"
    ref="player"
    :src="direct"
    :class="playerClasses"
    controls
    @loadedmetadata="onLoadedMetadata"
    @timeupdate="onTimeUpdate"
    @pause="onSettled"
    @ended="onSettled"
  />
  <audio
    v-else-if="direct"
    ref="player"
    :src="direct"
    :class="playerClasses"
    controls
    @loadedmetadata="onLoadedMetadata"
    @timeupdate="onTimeUpdate"
    @pause="onSettled"
    @ended="onSettled"
  />
  <p v-else :class="missingClasses">{{ props.labels.missingMedia }}</p>
</template>
