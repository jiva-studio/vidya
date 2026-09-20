<template>
  <div class="cover" :data-tone="tone" :style="toneStyle">
    <img v-if="coverUrl" :src="coverUrl" :alt="name" />
    <span v-else class="cover-initial" aria-hidden="true">{{ initial }}</span>

    <span v-if="schoolName" class="logo" data-testid="school-logo" :data-state="logoState">
      <img
        v-if="logoState === 'image'"
        :src="schoolLogoUrl!"
        :alt="schoolName"
        @error="onLogoFailed"
      />
      <template v-else>{{ schoolInitial }}</template>
    </span>

    <div class="cover-caption">
      <span class="scrim" aria-hidden="true" />
      <span class="cover-title">{{ name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { coverInitialOf, coverToneOf, coverToneRgb } from '../../model/courseCovers'
import type { CourseCoverProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The school's logo is a link rather than stored bytes, so offline it never
// resolves at all, and a school whose row has not arrived yet has no badge to
// draw. Neither may cost the cover its picture or its name.
const props = withDefaults(defineProps<CourseCoverProps>(), {
  coverUrl: undefined,
  schoolName: undefined,
  schoolLogoUrl: undefined,
})

/* --------------------------------- State ---------------------------------- */

const failed = ref(false)

// The same box either way, so a logo that gives up does not move the badge.
const logoState = computed(() =>
  props.schoolLogoUrl && !failed.value ? ('image' as const) : ('initial' as const),
)

const schoolInitial = computed(() => coverInitialOf(props.schoolName ?? ''))
const tone = computed(() => coverToneOf(props.name))
const initial = computed(() => coverInitialOf(props.name))
const toneStyle = computed(() => ({ '--cover-tone-rgb': coverToneRgb(tone.value) }))

/* --------------------------------- Hooks ---------------------------------- */

watch(
  () => props.schoolLogoUrl,
  () => (failed.value = false),
)

/* -------------------------------- Handlers -------------------------------- */

function onLogoFailed() {
  failed.value = true
}
</script>

<style scoped>
/* A ratio rather than a height: on a wide window a fixed height would stretch
   the picture, and a course would be a different shape on a tablet. */
.cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: rgba(var(--cover-tone-rgb), 0.18);
}

.cover > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-initial {
  color: rgba(var(--cover-tone-rgb), 0.85);
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
}

/* The caption is as tall as the name it holds, and the scrim fills the caption
   rather than a share of the picture — so the darkening follows a name onto a
   second line instead of being drawn over half the cover. */
.cover-caption {
  position: absolute;
  inset: auto 0 0 0;
  padding: 14px 16px 12px;
}

/* Warm espresso rather than stark black, and a fixed tone rather than a theme
   variable: what it darkens is a picture, which does not invert with the app. */
.scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(61, 43, 31, 0.88), rgba(61, 43, 31, 0));
  pointer-events: none;
}

.cover-title {
  position: relative;
  display: -webkit-box;
  color: var(--vidya-scrim-cream);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: break-word;
}

.logo {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--ion-color-light);
  color: var(--ion-text-color);
  font-weight: 600;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
