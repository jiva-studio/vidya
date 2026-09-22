<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { SidebarEntryProps } from '../types'
import { childClasses, itemClasses, subListClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SidebarEntryProps>(), { child: undefined })
</script>

<template>
  <RouterLink :class="itemClasses" :to="props.to">{{ props.label }}</RouterLink>
  <ul v-if="props.child" :class="subListClasses">
    <li>
      <RouterLink :class="childClasses" :to="props.child.to" aria-current="page">
        {{ props.child.label }}
      </RouterLink>
    </li>
  </ul>
</template>
