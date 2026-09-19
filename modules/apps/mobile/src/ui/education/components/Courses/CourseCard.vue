<template>
  <IonCard v-bind="$attrs">
    <IonCardHeader>
      <span v-if="schoolName" class="logo" data-testid="school-logo" :data-state="logoState">
        <img
          v-if="logoState === 'image'"
          :src="schoolLogoUrl!"
          :alt="schoolName"
          @error="onLogoFailed"
        />
        <template v-else>{{ initial }}</template>
      </span>

      <IonCardTitle>{{ name }}</IonCardTitle>
    </IonCardHeader>

    <IonCardContent v-if="description">
      {{ description }}
    </IonCardContent>
  </IonCard>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/vue'
import { computed, ref, watch } from 'vue'

import type { CourseCardProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The card draws what the device happens to hold. A school whose row has not
// arrived yet costs the badge and nothing else, and the logo is a link rather
// than stored bytes, so offline it never resolves at all.
const props = withDefaults(defineProps<CourseCardProps>(), {
  description: undefined,
  schoolName: undefined,
  schoolLogoUrl: undefined,
})

/* --------------------------------- State ---------------------------------- */

const failed = ref(false)

// The same box either way, so a logo that gives up does not move the card.
const logoState = computed(() =>
  props.schoolLogoUrl && !failed.value ? ('image' as const) : ('initial' as const),
)

const initial = computed(() => (props.schoolName ?? '').trim().charAt(0).toUpperCase())

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
.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--ion-color-light);
  font-weight: 600;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
