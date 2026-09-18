<template>
  <video
    v-if="isPlayable"
    ref="video"
    controls
    class="media"
    :src="block.url"
    :poster="block.posterUrl"
    @timeupdate="onTimeUpdate"
    @loadedmetadata="onLoadedMetadata"
  />

  <iframe v-else class="media" :src="block.url" allowfullscreen :title="$t('embedded-video')" />
</template>

<script lang="ts" setup>
import type { VideoBlock, VideoBlockState } from '@vidya/protocol'
import { computed, ref } from 'vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<{ block: VideoBlock; state?: VideoBlockState }>(), {
  state: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ change: [state: VideoBlockState] }>()

/* --------------------------------- State ---------------------------------- */

const video = ref<HTMLVideoElement>()

// Only a file we serve plays in a <video>; a YouTube or Vimeo link is an embed,
// and an embed reports no progress. v1 ships embeds only, so most blocks land
// on the iframe and simply do not track how much was watched.
const isPlayable = computed(() => props.block.source === 'upload' || props.block.source === 'url')

/* -------------------------------- Handlers -------------------------------- */

function onLoadedMetadata() {
  if (video.value) video.value.currentTime = props.state?.watched ?? 0
}

function onTimeUpdate() {
  const element = video.value
  if (!element) return
  emit('change', { type: 'video', watched: element.currentTime, duration: element.duration })
}
</script>

<style scoped>
.media {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
}
</style>
