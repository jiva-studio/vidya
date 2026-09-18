<template>
  <IonRadioGroup v-model="model">
    <GroupsListItem
      v-for="group in groups"
      :id="group.id"
      :key="group.id"
      :name="group.name"
    />
  </IonRadioGroup>
</template>

<script setup lang="ts">
import type { GroupSummary } from '@vidya/protocol'
import { IonRadioGroup } from '@ionic/vue'

import GroupsListItem from './GroupsListItem.vue'

/* --------------------------------- Props ---------------------------------- */

defineProps<{ groups: GroupSummary[] }>()

/* --------------------------------- State ---------------------------------- */

const model = defineModel<string>()
</script>
