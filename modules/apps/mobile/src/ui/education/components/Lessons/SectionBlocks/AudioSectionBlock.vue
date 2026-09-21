<template>
  <audio
    v-if="src"
    ref="audio"
    controls
    class="media"
    :src="src"
    @timeupdate="onTimeUpdate"
    @pause="onSettled"
    @ended="onSettled"
    @loadedmetadata="onLoadedMetadata"
  />

  <MediaUnavailableNotice v-else :reason="unavailableReason" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'

import MediaUnavailableNotice from './MediaUnavailableNotice.vue'
import { useProgressReporter } from './useProgressReporter'
import type { AudioSectionBlockEmits, AudioSectionBlockProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AudioSectionBlockProps>(), {
  state: undefined,
  src: undefined,
  unavailableReason: 'needs-connection',
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AudioSectionBlockEmits>()

/* --------------------------------- State ---------------------------------- */

const audio = ref<HTMLAudioElement>()

const reporter = useProgressReporter((element) =>
  emit('change', { type: 'audio', listened: element.currentTime, duration: element.duration }),
)

/* -------------------------------- Handlers -------------------------------- */

function onLoadedMetadata() {
  if (audio.value) audio.value.currentTime = props.state?.listened ?? 0
}

function onTimeUpdate() {
  reporter.tick(audio.value)
}

function onSettled() {
  reporter.settled(audio.value)
}
</script>

<style scoped>
.media {
  width: 100%;
}
</style>
