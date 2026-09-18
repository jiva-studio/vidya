<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />

      <template #bottom>
        <EducationTabBar />
      </template>
    </IonTabs>
  </IonPage>
</template>

<script setup lang="ts">
import { IonPage, IonRouterOutlet, IonTabs } from '@ionic/vue'

import EducationTabBar from './components/EducationTabBar.vue'
</script>
