<template>
  <video
    v-if="fileSrc"
    ref="video"
    controls
    class="media"
    :src="fileSrc"
    :poster="posterSrc"
    @timeupdate="onTimeUpdate"
    @pause="onSettled"
    @ended="onSettled"
    @loadedmetadata="onLoadedMetadata"
  />

  <iframe
    v-else-if="embedSrc"
    class="media"
    :src="embedSrc"
    allowfullscreen
    :title="$t('embedded-video')"
  />

  <MediaUnavailableNotice v-else :reason="unavailableReason" />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'

import MediaUnavailableNotice from './MediaUnavailableNotice.vue'
import { useProgressReporter } from './useProgressReporter'
import type { VideoSectionBlockEmits, VideoSectionBlockProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<VideoSectionBlockProps>(), {
  state: undefined,
  src: undefined,
  posterSrc: undefined,
  unavailableReason: 'needs-connection',
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<VideoSectionBlockEmits>()

/* --------------------------------- State ---------------------------------- */

const video = ref<HTMLVideoElement>()

// Only a file we serve plays in a <video>; a YouTube or Vimeo link is an embed,
// and an embed reports no progress. v1 ships embeds only, so most blocks land
// on the iframe and simply do not track how much was watched.
const isFile = computed(() => props.block.source === 'upload' || props.block.source === 'url')

const fileSrc = computed(() => (isFile.value ? props.src : undefined))
const embedSrc = computed(() => (isFile.value ? undefined : props.src))

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
