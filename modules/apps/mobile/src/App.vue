<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { watch } from 'vue'

import { useSession } from '@/app'

/* --------------------------------- State ---------------------------------- */

const { session } = useSession()
const router = useRouter()

/* --------------------------------- Hooks ---------------------------------- */

// The session ends on its own when the server rejects the token, and the
// student has to land somewhere they can act rather than on a screen that only
// says the session expired.
watch(session, (value) => {
  if (!value) router.replace({ name: 'signin' })
})
</script>
