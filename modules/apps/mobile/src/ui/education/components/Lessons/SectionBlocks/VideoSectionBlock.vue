<template>
  <video
    v-if="isPlayable"
    ref="video"
    controls
    class="media"
    :src="block.url"
    :poster="block.posterUrl"
    @timeupdate="onTimeUpdate"
    @pause="onSettled"
    @ended="onSettled"
    @loadedmetadata="onLoadedMetadata"
  />

  <iframe v-else class="media" :src="block.url" allowfullscreen :title="$t('embedded-video')" />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'

import { useProgressReporter } from './useProgressReporter'
import type { VideoSectionBlockEmits, VideoSectionBlockProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<VideoSectionBlockProps>(), { state: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<VideoSectionBlockEmits>()

/* --------------------------------- State ---------------------------------- */

const video = ref<HTMLVideoElement>()

// Only a file we serve plays in a <video>; a YouTube or Vimeo link is an embed,
// and an embed reports no progress. v1 ships embeds only, so most blocks land
// on the iframe and simply do not track how much was watched.
const isPlayable = computed(() => props.block.source === 'upload' || props.block.source === 'url')

const reporter = useProgressReporter((element) =>
  emit('change', { type: 'video', watched: element.currentTime, duration: element.duration }),
)

/* -------------------------------- Handlers -------------------------------- */

function onLoadedMetadata() {
  if (video.value) video.value.currentTime = props.state?.watched ?? 0
}

function onTimeUpdate() {
  reporter.tick(video.value)
}

function onSettled() {
  reporter.settled(video.value)
}
</script>

<style scoped>
.media {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
}
</style>
