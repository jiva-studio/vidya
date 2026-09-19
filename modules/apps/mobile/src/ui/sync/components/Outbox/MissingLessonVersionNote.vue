<template>
  <div class="note">
    <IonText color="medium">
      <strong>{{ $t('sync-missing-lesson-version-title') }}</strong>
    </IonText>
    <IonNote>{{ $t('sync-missing-lesson-version-text') }}</IonNote>
  </div>
</template>

<script lang="ts" setup>
import { IonNote, IonText } from '@ionic/vue'

// Stands in for a lesson version that has not reached the device yet. Scope
// positions move independently and the device schema has no foreign keys, so an
// answer without its parent is a legal order of arrival, not a fault.
</script>

<style scoped>
.note {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
