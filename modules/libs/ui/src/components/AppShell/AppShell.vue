<script setup lang="ts">
import { cn } from '../../lib/utils'
import { contentClasses, headerClasses, mainClasses, shellClasses, sidebarClasses } from './styles'
import type { AppShellProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AppShellProps>(), { class: undefined })
</script>

<template>
  <div :class="cn(shellClasses, props.class)">
    <aside v-if="$slots.sidebar" :class="sidebarClasses">
      <slot name="sidebar" />
    </aside>
    <div :class="mainClasses">
      <header v-if="$slots.header" :class="headerClasses">
        <slot name="header" />
      </header>
      <main :class="contentClasses">
        <slot />
      </main>
    </div>
  </div>
</template>
