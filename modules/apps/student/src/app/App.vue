<script setup lang="ts">
import { AppShell } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useConnection } from '@/shared/connection'
import {
  brandClasses,
  compactNavClasses,
  loneClasses,
  navClasses,
  navLinkClasses,
} from '@/shared/ui'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const { isSignedIn } = useConnection()

// The sections of the site, in the order they are offered. Written once and
// drawn twice: the sidebar is not there on a narrow screen, and a navigation
// that exists only on a wide one is a navigation half the students never see.
const sections = [
  { to: '/', label: 'nav-courses' },
  { to: '/learning', label: 'nav-my-courses' },
  { to: '/homework', label: 'nav-homework' },
  { to: '/settings', label: 'nav-settings' },
]

// Sign-in and a school's joining page say so on their own route, rather than
// the shell guessing from the address.
const withChrome = computed(() => route.meta.chrome !== false && isSignedIn.value)
</script>

<template>
  <AppShell v-if="withChrome">
    <template #sidebar>
      <p :class="brandClasses">{{ $t('site-title') }}</p>
      <nav :class="navClasses" :aria-label="$t('nav-label')">
        <RouterLink
          v-for="section in sections"
          :key="section.to"
          :class="navLinkClasses"
          :to="section.to"
        >
          {{ $t(section.label) }}
        </RouterLink>
      </nav>
    </template>

    <nav :class="compactNavClasses" :aria-label="$t('nav-label')">
      <RouterLink
        v-for="section in sections"
        :key="section.to"
        :class="navLinkClasses"
        :to="section.to"
      >
        {{ $t(section.label) }}
      </RouterLink>
    </nav>

    <RouterView />
  </AppShell>

  <main v-else :class="loneClasses"><RouterView /></main>
</template>
