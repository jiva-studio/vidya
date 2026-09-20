<template>
  <IonPage>
    <IonHeader class="flat-header ion-no-border">
      <PageToolbar :title="title" :back-href="backHref" />
      <slot name="toolbar" />
    </IonHeader>

    <IonContent :fullscreen="true" :class="{ 'ion-padding': hasPadding }">
      <!-- Above the loading/error/empty chain rather than inside it: what a
           notice has to say is usually the reason the page is empty. -->
      <slot name="notice" />

      <LoadingSpinner v-if="showSpinner" />
      <slot v-else-if="error" name="error">
        <IonNote class="page-state">{{ error }}</IonNote>
      </slot>
      <slot v-else-if="isEmpty" name="empty">
        <IonNote class="page-state">{{ emptyText }}</IonNote>
      </slot>
      <slot v-else />

      <div class="reserved-space" aria-hidden="true" />
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { IonContent, IonHeader, IonNote, IonPage } from '@ionic/vue'
import { computed } from 'vue'

import LoadingSpinner from '../components/LoadingSpinner.vue'
import PageToolbar from '../components/PageToolbar.vue'
import type { PageWithHeaderLayoutProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PageWithHeaderLayoutProps>(), {
  backHref: '/education/courses',
  hasPadding: false,
  busy: false,
  hasData: false,
  isEmpty: false,
  error: undefined,
  emptyText: '',
})

/* --------------------------------- State ---------------------------------- */

// A refresh over content already on screen must not blank the page out.
const showSpinner = computed(() => props.busy && !props.hasData)
</script>

<style scoped>
.reserved-space {
  height: var(--vidya-page-reserved-space, 0px);
}

.page-state {
  display: block;
  padding: 2rem 1rem;
  text-align: center;
}
</style>
