<template>
  <IonPage>
    <IonHeader>
      <PageToolbar :title="title" />
      <slot name="toolbar" />
    </IonHeader>

    <IonContent :fullscreen="true" :class="{ 'ion-padding': hasPadding }">
      <LoadingSpinner v-if="showSpinner" />
      <slot v-else-if="error" name="error">
        <IonNote class="page-state">{{ error }}</IonNote>
      </slot>
      <slot v-else-if="isEmpty" name="empty">
        <IonNote class="page-state">{{ emptyText }}</IonNote>
      </slot>
      <slot v-else />
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { IonContent, IonHeader, IonNote, IonPage } from '@ionic/vue'
import { computed } from 'vue'

import LoadingSpinner from '../components/LoadingSpinner.vue'
import PageToolbar from '../components/PageToolbar.vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(
  defineProps<{
    title: string
    hasPadding?: boolean
    busy?: boolean
    hasData?: boolean
    isEmpty?: boolean
    error?: string
    emptyText?: string
  }>(),
  {
    hasPadding: false,
    busy: false,
    hasData: false,
    isEmpty: false,
    error: undefined,
    emptyText: '',
  },
)

/* --------------------------------- State ---------------------------------- */

// A refresh over content already on screen must not blank the page out.
const showSpinner = computed(() => props.busy && !props.hasData)
</script>

<style scoped>
.page-state {
  display: block;
  padding: 2rem 1rem;
  text-align: center;
}
</style>
