<template>
  <GroupsListItem
    v-for="item in items"
    :key="item.id"
    :value="item.id"
    :name="item.name"
    :description="item.description"
    :selectable="selectable"
  />
</template>

<script setup lang="ts">
import GroupsListItem from './GroupsListItem.vue'
import type { GroupsListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

withDefaults(defineProps<GroupsListProps>(), { selectable: false })
</script>
