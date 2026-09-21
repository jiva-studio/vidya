<template>
  <IonPage class="ion-padding">
    <IonList>
      <h1>{{ $t('sign-up') }}</h1>
      {{ $t('need-some-information') }}
      <br />
      <br />

      <IonInput
        v-model="name"
        :label="$t('name')"
        label-placement="stacked"
        fill="outline"
        :placeholder="$t('name-placeholder')"
      />
      <br />

      <IonInput
        v-model="phoneNumber"
        :label="$t('phone-number')"
        label-placement="stacked"
        fill="outline"
        placeholder="888-888-8888"
        type="tel"
      />
      <br />

      <IonCheckbox v-model="conditionsAccepted" label-placement="end" justify="start">
        {{ $t('i-agree-to-the-terms') }}
      </IonCheckbox>
    </IonList>

    <AsyncButton expand="block" :disabled="!canSubmit" :busy="busy" @click="onSignUpButtonClicked">
      {{ $t('sign-up') }}
    </AsyncButton>
  </IonPage>
</template>

<script lang="ts" setup>
import { IonCheckbox, IonInput, IonList, IonPage, useIonRouter } from '@ionic/vue'
import { computed, ref } from 'vue'

import { clientForSignIn } from '@/app'
import { config as environment } from '@/config'
import { AsyncButton } from '@/design'
import { useAuthToast } from '@/ui/auth/composables/useAuthToast'
import { auth } from '@vidya/client'

/* --------------------------------- State ---------------------------------- */

const client = clientForSignIn(environment.apiBaseUrl)
const router = useIonRouter()
const toast = useAuthToast()

const name = ref('')
const phoneNumber = ref('')
const conditionsAccepted = ref(false)
const busy = ref(false)

const canSubmit = computed(() => name.value.trim().length > 0 && conditionsAccepted.value)

/* -------------------------------- Handlers -------------------------------- */

async function onSignUpButtonClicked() {
  if (busy.value) return

  busy.value = true
  try {
    if (!(await saveDetails())) return
    router.navigate({ name: 'courses' }, 'root', 'replace')
  } finally {
    busy.value = false
  }
}

/* -------------------------------- Helpers --------------------------------- */

/**
 * Send the details up, and say whether they arrived.
 *
 * Both calls are guarded together because both end the same way for the person
 * in front of the form: nothing of what they typed is stored. Navigation is
 * outside the guard — it comes after the details are safe, and a failure to
 * move screens is not a failure to save.
 */
async function saveDetails(): Promise<boolean> {
  try {
    // The profile the token belongs to is the one being filled in, so its id
    // comes from the server rather than from anything the form holds.
    const profile = await auth.getProfile(client)
    await auth.updateProfile(client, profile.userId, {
      name: name.value,
      phone: phoneNumber.value || undefined,
    })

    return true
  } catch {
    await toast.show('could-not-save')
    return false
  }
}
</script>
