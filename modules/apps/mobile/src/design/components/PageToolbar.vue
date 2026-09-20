<template>
  <IonToolbar>
    <IonTitle>{{ title }}</IonTitle>
    <IonButtons v-if="backHref !== null" slot="start">
      <IonBackButton :default-href="backHref" />
    </IonButtons>
  </IonToolbar>
</template>

<script setup lang="ts">
import { IonBackButton, IonButtons, IonTitle, IonToolbar } from '@ionic/vue'

import type { PageToolbarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// A page opened from a link has no stack behind it, and a back button with
// nowhere to go hides itself. The href is what a screen reached that way
// returns to, so the way out does not depend on how the screen was reached.
withDefaults(defineProps<PageToolbarProps>(), { backHref: '/education/courses' })
</script>
