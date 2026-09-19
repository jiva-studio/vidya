<template>
  <div class="badge" :data-state="state">
    <IonIcon :icon="icon" :color="color" aria-hidden="true" />
    <IonText :color="color">{{ label }}</IonText>
    <IonNote class="hint">{{ hint }}</IonNote>
  </div>
</template>

<script lang="ts" setup>
import { IonIcon, IonNote, IonText } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { stateColors, stateIcons } from './styles'
import type { SyncStateBadgeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SyncStateBadgeProps>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const icon = computed(() => stateIcons[props.state])
const color = computed(() => stateColors[props.state])
const label = computed(() => fluent.$t(`sync-state-${props.state}`))
const hint = computed(() => fluent.$t(`sync-state-${props.state}-hint`))
</script>

<style scoped>
.badge {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.hint {
  flex-basis: 100%;
  font-size: 0.85em;
}
</style>
