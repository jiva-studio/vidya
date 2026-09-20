<script setup lang="ts">
import { Thumbnail } from '@vidya/ui'

import { tileButtonClasses, tileNameClasses } from './styles'
import type { MediaLibraryTileEmits, MediaLibraryTileProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaLibraryTileProps>(), { src: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaLibraryTileEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onPick() {
  emit('pick', props.record)
}
</script>

<template>
  <button type="button" :class="tileButtonClasses" @click="onPick">
    <Thumbnail :kind="props.record.kind" :src="props.src" :alt="props.record.name" />
    <span :class="tileNameClasses">{{ props.record.name }}</span>
  </button>
</template>
