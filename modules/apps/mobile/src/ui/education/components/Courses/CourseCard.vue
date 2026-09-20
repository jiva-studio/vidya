<template>
  <IonCard v-bind="$attrs">
    <CourseCover
      :name="name"
      :cover-url="coverUrl"
      :school-name="schoolName"
      :school-logo-url="schoolLogoUrl"
    />

    <IonCardContent v-if="description">
      <span class="description">{{ description }}</span>
    </IonCardContent>
  </IonCard>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent } from '@ionic/vue'

import CourseCover from './CourseCover.vue'
import type { CourseCardProps } from './types'

/* --------------------------------- Props ---------------------------------- */

withDefaults(defineProps<CourseCardProps>(), {
  description: undefined,
  coverUrl: undefined,
  schoolName: undefined,
  schoolLogoUrl: undefined,
})
</script>

<style scoped>
/* Cut by lines, not by characters: a count of characters lands mid-word and
   measures a different amount of text in every language.

   The clamp on its own only puts the ellipsis in — the line after it is still
   laid out, and `overflow` clips at the padding box, so that line shows
   through the padding underneath. The clamp therefore sits on an inner box
   with no padding of its own, capped at exactly that many line boxes. */
.description {
  --course-description-lines: 3;
  --course-description-line-height: 1.5;

  display: -webkit-box;
  overflow: hidden;
  line-height: var(--course-description-line-height);
  -webkit-line-clamp: var(--course-description-lines);
  -webkit-box-orient: vertical;
  max-height: calc(var(--course-description-lines) * var(--course-description-line-height) * 1em);
}
</style>
