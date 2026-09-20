<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />

      <!-- `slot` rather than a named slot of IonTabs: `ion-tabs` is a custom
           element whose bar is placed by the real slot attribute, and the Vue
           wrapper renders nothing but its default slot. -->
      <EducationTabBar slot="bottom" />
    </IonTabs>
  </IonPage>
</template>

<script setup lang="ts">
import { IonPage, IonRouterOutlet, IonTabs } from '@ionic/vue'

import EducationTabBar from './components/EducationTabBar.vue'
</script>
