<template>
  <PageWithHeaderLayout :title="$t('settings-title')" :back-href="null" :has-padding="true">
    <IonNote class="coming">{{ $t('settings-coming') }}</IonNote>

    <WithListHeader :title="$t('settings-account-title')">
      <IonNote class="note">{{ $t('settings-sign-out-note') }}</IonNote>

      <AsyncButton :busy="busy" @click="onSignOutClicked()">
        {{ $t('settings-sign-out') }}
      </AsyncButton>
    </WithListHeader>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import { IonNote, useIonRouter } from '@ionic/vue'
import { ref } from 'vue'

import { useConnections } from '@/app'
import { AsyncButton, PageWithHeaderLayout, WithListHeader } from '@/design'

/* --------------------------------- State ---------------------------------- */

const connections = useConnections()
const router = useIonRouter()
const busy = ref(false)

/* -------------------------------- Handlers -------------------------------- */

// Every connection, not the first one: a student can be signed in to several
// schools, and a button that said "sign out" and left one behind would leave
// the app looking signed in with no way to say so.
async function onSignOutClicked() {
  if (busy.value) return

  busy.value = true
  try {
    for (const connection of [...connections.connections.value]) {
      await connections.signOut(connection.baseUrl)
    }

    // The guard that keeps a visitor with no connection out of the screens runs
    // on a navigation, and signing out is not one: without this the student is
    // left looking at a settings page belonging to an account that is gone.
    router.navigate({ name: 'signin' }, 'root', 'replace')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.coming {
  display: block;
  padding-bottom: 1.5rem;
}

.note {
  display: block;
  padding-bottom: 0.75rem;
}
</style>
