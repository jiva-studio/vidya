<template>
  <WithBorders>
    <template #end>
      <IonIcon :icon="arrowBackOutline" aria-hidden="true" @click="onBackClicked" />
    </template>
    <IonInput v-bind="$attrs" type="number" :placeholder="$t('code')" />
  </WithBorders>
</template>

<script lang="ts" setup>
import { IonInput, IonIcon } from '@ionic/vue'
import { WithBorders } from '@/design'
import { arrowBackOutline } from 'ionicons/icons'

/* -------------------------------------------------------------------------- */
/*                                  Interface                                 */
/* -------------------------------------------------------------------------- */

const emit = defineEmits<{
  'back-button-click': []
}>()

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                  */
/* -------------------------------------------------------------------------- */

function onBackClicked() {
  emit('back-button-click')
}
</script>

<style scoped>
ion-icon {
  opacity: 0.5;
  scale: 0.8;
}
</style>
