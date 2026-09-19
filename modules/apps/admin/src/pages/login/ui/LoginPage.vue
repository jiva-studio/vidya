<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import { OtpForm } from '@/features/auth-otp'

import { pageClasses, panelClasses, titleClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()

/* -------------------------------- Handlers -------------------------------- */

// Back to where the operator was thrown out of, not to the root. A link to one
// screen pasted into a chat has to open that screen after signing in.
function onSignedIn() {
  const redirect = route.query.redirect
  const target = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
  void router.replace(target)
}
</script>

<template>
  <div :class="pageClasses">
    <div :class="panelClasses">
      <h1 :class="titleClasses">{{ $t('auth-title') }}</h1>
      <OtpForm @signed-in="onSignedIn" />
    </div>
  </div>
</template>
