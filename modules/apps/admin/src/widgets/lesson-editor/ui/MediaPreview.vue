<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useMediaGateway } from '@/entities/media'
import { embedSrc, mediaSrc } from '@/features/edit-lesson-content'

import { frameClasses, mutedClasses, playerClasses } from './styles'
import type { MediaPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const gateway = useMediaGateway()

// Both are `undefined` unless the URL passed the model's check, so a refused
// link renders as a message rather than as a frame pointed at whatever it said.
const embed = computed(() => embedSrc(props.block.source, props.block.url))

const direct = ref<string | undefined>(undefined)
const asked = ref(false)
const player = ref<HTMLMediaElement | undefined>(undefined)

const isVideo = computed(() => props.block.type === 'video')

/**
 * An address the player can load, asked for before the player is drawn.
 *
 * An uploaded file is stored under a path only the gateway can answer, and the
 * answer is a signature with a lifetime. Assigning it in place rather than
 * recomputing it is what keeps the element alive across a re-signing: a player
 * that is replaced starts the lecture again from the beginning.
 */
const readAddress = async (): Promise<void> => {
  if (props.block.source !== 'upload') {
    direct.value = mediaSrc(props.block.source, props.block.url)
    asked.value = true
    return
  }

  try {
    await gateway.prime?.([props.block.url])
    direct.value = gateway.resolve(props.block.url)
  } catch {
    // Whatever stopped the asking, this block has no address to draw and says
    // so; the reason itself is the gateway's to announce, once per screen.
    direct.value = undefined
  }

  asked.value = true
}

// A signature that expired mid-lecture is refused by storage, which the player
// reports as an error and nothing else: it is asked for again rather than shown
// as a broken file, because the file is not broken. Bounded, because a file
// that is genuinely gone reports the same error for every address it is given.
const Resignings = 3
let resigned = 0

/**
 * A new address for the element already on screen, resumed where it was.
 *
 * Assigning `src` runs the resource selection algorithm, which returns the
 * element to the beginning, so the position is carried across by hand. Once the
 * addresses are spent the absence is stated: a player left holding a source
 * storage refuses shows nothing and explains nothing.
 */
const resign = async (): Promise<void> => {
  if (resigned >= Resignings) {
    direct.value = undefined
    asked.value = true
    return
  }

  resigned += 1
  const at = player.value?.currentTime ?? 0

  await readAddress()
  await nextTick()

  if (player.value) player.value.currentTime = at
}

watch(() => props.block.url, readAddress, { immediate: true })

/* -------------------------------- Handlers -------------------------------- */

function onPlayerError() {
  void resign()
}
</script>

<template>
  <!--
    One element for the whole preview, laid out as if it were not there: the
    player appears only once an address has been asked for, and a root that
    comes and goes takes the block's place in the document with it.
  -->
  <div class="contents">
    <iframe
      v-if="embed"
      :src="embed"
      :class="frameClasses"
      :title="$t('editor-preview-embed-title')"
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
      @error="onPlayerError"
    />
    <audio
      v-else-if="direct"
      ref="player"
      :src="direct"
      :class="playerClasses"
      controls
      @error="onPlayerError"
    />
    <p v-else-if="asked" :class="mutedClasses">{{ $t('editor-preview-media-missing') }}</p>
  </div>
</template>
