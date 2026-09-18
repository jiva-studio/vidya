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
import type { AudioBlock, AudioBlockState } from '@vidya/protocol'
import { ref } from 'vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<{ block: AudioBlock; state?: AudioBlockState }>(), {
  state: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ change: [state: AudioBlockState] }>()

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
