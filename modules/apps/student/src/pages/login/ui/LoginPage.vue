<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import { OtpForm } from '@/features/auth-otp'
import { titleClasses } from '@/shared/ui'

import { panelClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()

/* -------------------------------- Handlers -------------------------------- */

// Back to where the visitor was turned away from, not to the root: a link to
// one lesson, or a school's joining page, has to open after signing in.
function onSignedIn() {
  const redirect = route.query.redirect
  const target = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
  void router.replace(target)
}
</script>

<template>
  <div :class="panelClasses">
    <h1 :class="titleClasses">{{ $t('auth-title') }}</h1>
    <OtpForm @signed-in="onSignedIn" />
  </div>
</template>
