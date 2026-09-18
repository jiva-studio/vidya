<template>
  <IonTabBar>
    <EducationTab
      tab="explore"
      href="/education/courses"
      :icon="searchOutline"
      :label="$t('tab-courses')"
    />
    <EducationTab
      tab="my-enrollments"
      href="/education/my-enrollments"
      :icon="bookOutline"
      :label="$t('tab-my-enrollments')"
    />
  </IonTabBar>
</template>

<script setup lang="ts">
import { IonTabBar } from '@ionic/vue'
import { bookOutline, searchOutline } from 'ionicons/icons'

import EducationTab from './EducationTab.vue'
</script>
