<script setup lang="ts">
import { computed } from 'vue'

import Badge from '../Badge'
import { cn } from '../../lib/utils'
import { itemClasses, itemIconClasses, itemLabelClasses } from './styles'
import type { SidebarItemEmits, SidebarItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SidebarItemProps>(), { class: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SidebarItemEmits>()

/* --------------------------------- State ---------------------------------- */

const tag = computed(() => (props.item.href ? 'a' : 'button'))
const current = computed(() => (props.item.active ? 'page' : undefined))

/* -------------------------------- Handlers -------------------------------- */

function onSelect() {
  if (props.item.disabled) return
  emit('select', props.item.key)
}
</script>

<template>
  <component
    :is="tag"
    :href="props.item.href"
    :type="props.item.href ? undefined : 'button'"
    :aria-current="current"
    :aria-disabled="props.item.disabled || undefined"
    :class="cn(itemClasses, props.class)"
    @click="onSelect"
  >
    <component :is="props.item.icon" v-if="props.item.icon" :class="itemIconClasses" />
    <span :class="itemLabelClasses">{{ props.item.label }}</span>
    <Badge v-if="props.item.badge" tone="neutral">{{ props.item.badge }}</Badge>
  </component>
</template>
