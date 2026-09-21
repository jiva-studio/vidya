<template>
  <IonRadioGroup :model-value="modelValue" @update:model-value="onSelectionChanged">
    <GroupsList :items="groups" :selectable="true" />
  </IonRadioGroup>
</template>

<script setup lang="ts">
import { IonRadioGroup } from '@ionic/vue'
import type { GroupId } from '@vidya/domain'

import { GroupsList } from '../components/Groups'
import type { GroupSelectorEmits, GroupSelectorProps } from './types'

/**
 * Which group the student would like, chosen from the ones handed to it.
 *
 * Which groups those are is the page's question: two screens ask it, and a
 * predicate written into the component would be the second copy of a filter
 * that has already changed meaning once.
 */

/* --------------------------------- Props ---------------------------------- */

defineProps<GroupSelectorProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupSelectorEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelectionChanged(value: GroupId | null | undefined) {
  emit('update:modelValue', value ?? null)
}
</script>
