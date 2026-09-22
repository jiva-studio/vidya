<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { JoinPanel } from '@/features/join-school'

import { panelClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()

// The public code of the school, never its identifier: this address is printed
// on paper and read aloud, and it is resolved by the server, not by the token.
const code = computed(() => String(route.params.code ?? ''))

/* -------------------------------- Handlers -------------------------------- */

// Signing in comes back here rather than to the front page: the person came to
// join this school, and a front page with nothing on it is not where that ends.
function onSignIn() {
  void router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function onJoined() {
  void router.push('/')
}
</script>

<template>
  <div :class="panelClasses"><JoinPanel :code="code" @sign-in="onSignIn" @joined="onJoined" /></div>
</template>
