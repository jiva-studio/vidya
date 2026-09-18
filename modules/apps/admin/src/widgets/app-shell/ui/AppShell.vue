<script setup lang="ts">
import type { AppShellEmits } from '../types'
import {
  brandClasses,
  contentClasses,
  footerClasses,
  mainClasses,
  shellClasses,
  sidebarClasses,
  signOutClasses,
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
      <p :class="brandClasses">{{ $t('app-name') }}</p>
      <slot name="school" />
      <slot name="nav" />
      <div :class="footerClasses">
        <button :class="signOutClasses" type="button" @click="onSignOut">
          {{ $t('action-sign-out') }}
        </button>
      </div>
    </aside>
    <main :class="mainClasses">
      <div :class="contentClasses">
        <slot />
      </div>
    </main>
  </div>
</template>
