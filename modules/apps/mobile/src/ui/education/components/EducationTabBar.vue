<template>
  <IonTabBar>
    <!-- The buttons are written out here rather than wrapped in a component of
         our own: ion-tab-bar finds its tabs by walking its rendered children
         for IonTabButton vnodes, and a wrapper hides them, leaving a bar that
         never marks a tab as selected. -->
    <IonTabButton tab="explore" href="/education/courses" :aria-label="$t('tab-courses')">
      <IonIcon aria-hidden="true" :icon="albums" />
    </IonTabButton>

    <IonTabButton
      tab="my-enrollments"
      href="/education/my-enrollments"
      :aria-label="$t('tab-my-enrollments')"
    >
      <IonIcon aria-hidden="true" :icon="book" />
    </IonTabButton>

    <IonTabButton tab="settings" href="/education/settings" :aria-label="$t('tab-settings')">
      <IonIcon aria-hidden="true" :icon="settings" />
    </IonTabButton>
  </IonTabBar>
</template>

<script setup lang="ts">
import { IonIcon, IonTabBar, IonTabButton } from '@ionic/vue'
import { albums, book, settings } from 'ionicons/icons'
</script>

<style scoped>
ion-tab-bar {
  --border: 0;
  --background: linear-gradient(
    to bottom,
    rgba(var(--vidya-fade-bg-rgb), 0) 0%,
    rgba(var(--vidya-fade-bg-rgb), 0.8) 35%,
    rgba(var(--vidya-fade-bg-rgb), 1) 100%
  );
  padding-top: 12px;
}

/* A filled glyph carries more weight than an outlined one, so an unselected tab
   is stepped back rather than left to compete with the selected one on colour
   alone. */
ion-tab-button {
  --ripple-color: rgba(0, 0, 0, 0);

  opacity: 0.45;
}

ion-tab-button.tab-selected {
  opacity: 1;
}

ion-icon {
  font-size: 26px;
}
</style>
