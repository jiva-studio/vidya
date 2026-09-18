<template>
  <audio
    ref="audio"
    controls
    class="media"
    :src="block.url"
    @timeupdate="onTimeUpdate"
    @loadedmetadata="onLoadedMetadata"
  />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import type { AudioSectionBlockEmits, AudioSectionBlockProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AudioSectionBlockProps>(), { state: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AudioSectionBlockEmits>()

/* --------------------------------- State ---------------------------------- */

const audio = ref<HTMLAudioElement>()

/* -------------------------------- Handlers -------------------------------- */

function onLoadedMetadata() {
  if (audio.value) audio.value.currentTime = props.state?.listened ?? 0
}

function onTimeUpdate() {
  const element = audio.value
  if (!element) return
  emit('change', { type: 'audio', listened: element.currentTime, duration: element.duration })
}
</script>

<style scoped>
.media {
  width: 100%;
}
</style>
