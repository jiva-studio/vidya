<template>
  <div class="banner" :data-mode="mode">
    <IonIcon :icon="icon" :color="color" aria-hidden="true" />
    <IonText :color="color">{{ title }}</IonText>
    <IonNote v-if="!online" class="hint">{{ $t('sync-offline-text') }}</IonNote>
  </div>
</template>

<script lang="ts" setup>
import { IonIcon, IonNote, IonText } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { bannerColors, bannerIcons, bannerTitles, type BannerMode } from './styles'
import type { OfflineBannerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// Offline is a mode of the app, not a failure of it: the wording and the colour
// say what still works rather than what broke.
const props = withDefaults(defineProps<OfflineBannerProps>(), { syncing: false })

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const mode = computed(() => modeOf(props.online, props.syncing))
const icon = computed(() => bannerIcons[mode.value])
const color = computed(() => bannerColors[mode.value])
const title = computed(() => fluent.$t(bannerTitles[mode.value]))

/* -------------------------------- Helpers --------------------------------- */

function modeOf(online: boolean, syncing: boolean): BannerMode {
  if (!online) return 'offline'

  return syncing ? 'syncing' : 'synced'
}
</script>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 16px;
}

.hint {
  flex-basis: 100%;
  font-size: 0.85em;
}
</style>
