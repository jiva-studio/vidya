<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useConnection } from '@/shared/connection'
import { contentClasses, navClasses, navLinkClasses, shellClasses } from '@/shared/ui'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const { isSignedIn } = useConnection()

// Sign-in and a school's joining page say so on their own route, rather than
// the shell guessing from the address.
const withChrome = computed(() => route.meta.chrome !== false && isSignedIn.value)
</script>

<template>
  <div v-if="withChrome" :class="shellClasses">
    <nav :class="navClasses">
      <RouterLink :class="navLinkClasses" to="/">{{ $t('nav-learning') }}</RouterLink>
      <RouterLink :class="navLinkClasses" to="/homework">{{ $t('nav-homework') }}</RouterLink>
      <RouterLink :class="navLinkClasses" to="/settings">{{ $t('nav-settings') }}</RouterLink>
    </nav>
    <main :class="contentClasses"><RouterView /></main>
  </div>
  <main v-else :class="contentClasses"><RouterView /></main>
</template>
