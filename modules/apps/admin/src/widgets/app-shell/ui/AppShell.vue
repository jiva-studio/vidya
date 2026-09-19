<script setup lang="ts">
import type { AppShellEmits } from '../types'
import {
  contentClasses,
  footerClasses,
  mainClasses,
  shellClasses,
  sidebarClasses,
} from './styles'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AppShellEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSignOut() {
  emit('sign-out')
}
</script>

<template>
  <div :class="shellClasses">
    <aside :class="sidebarClasses">
      <slot name="school" />
      <slot name="nav" />
      <div :class="footerClasses">
        <slot name="profile">
          <slot name="footer" />
        </slot>
      </div>
    </aside>
    <main :class="mainClasses">
      <div :class="contentClasses">
        <slot />
      </div>
    </main>
  </div>
</template>
