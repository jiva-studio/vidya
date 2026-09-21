<template>
  <div class="unavailable" data-testid="media-unavailable">
    <IonNote>{{ $t('media-needs-connection') }}</IonNote>
  </div>
</template>

<script lang="ts" setup>
import { IonNote } from '@ionic/vue'
</script>

<style scoped>
.unavailable {
  display: flex;
  padding: 16px;
}
</style>
