<script setup lang="ts">
import { Image, Music, Video } from 'lucide-vue-next'
import { computed } from 'vue'

import { cn } from '../../lib/utils'
import { iconClasses, imageClasses, placeholderClasses, tileVariants } from './styles'
import type { ThumbnailKind, ThumbnailProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ThumbnailProps>(), {
  src: undefined,
  selected: false,
  class: undefined,
})

/* --------------------------------- State ---------------------------------- */

const placeholderIcon = computed(() => iconFor(props.kind))

/* -------------------------------- Helpers --------------------------------- */

// A sound file has no frame to show and a video's poster is not always there,
// so the kind is what the tile falls back to naming.
function iconFor(kind: ThumbnailKind): typeof Image {
  return { image: Image, video: Video, audio: Music }[kind]
}
</script>

<template>
  <div :class="cn(tileVariants({ selected: props.selected }), props.class)">
    <img
      v-if="props.src && props.kind === 'image'"
      :src="props.src"
      :alt="props.alt"
      :class="imageClasses"
    />
    <div v-else :class="placeholderClasses" role="img" :aria-label="props.alt">
      <component :is="placeholderIcon" :class="iconClasses" />
    </div>
  </div>
</template>
