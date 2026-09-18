<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'

// The session is restored before the first route resolves, in main.ts, so there
// is nothing left for the shell itself to do on mount.
</script>
