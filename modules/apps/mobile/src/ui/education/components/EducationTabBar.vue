<template>
  <IonTabBar>
    <EducationTab
      tab="explore"
      href="/education/courses"
      :icon="searchOutline"
      :label="$t('courses')"
    />
    <EducationTab
      tab="my-enrollments"
      href="/education/my-enrollments"
      :icon="bookOutline"
      :label="$t('my-enrollments')"
    />
  </IonTabBar>
</template>

<script setup lang="ts">
import { IonTabBar } from '@ionic/vue'
import { bookOutline, searchOutline } from 'ionicons/icons'

import EducationTab from './EducationTab.vue'
</script>

<fluent locale="en">
courses = Courses
my-enrollments = My courses
</fluent>

<fluent locale="ru">
courses = Курсы
my-enrollments = Мои курсы
</fluent>
