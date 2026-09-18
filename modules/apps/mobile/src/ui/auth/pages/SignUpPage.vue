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

    <IonNote v-if="error" color="danger">
      {{ error }}
    </IonNote>

    <AsyncButton expand="block" :disabled="!canSubmit" :busy="busy" @click="onSignUpButtonClicked">
      {{ $t('sign-up') }}
    </AsyncButton>
  </IonPage>
</template>

<script lang="ts" setup>
import { IonCheckbox, IonInput, IonList, IonNote, IonPage, useIonRouter } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import { useApi } from '@/app'
import { AsyncButton } from '@/design'
import { auth } from '@/usecases'

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()
const fluent = useFluent()

const name = ref('')
const phoneNumber = ref('')
const conditionsAccepted = ref(false)
const busy = ref(false)
const error = ref<string | undefined>(undefined)

const canSubmit = computed(() => name.value.trim().length > 0 && conditionsAccepted.value)

/* -------------------------------- Handlers -------------------------------- */

async function onSignUpButtonClicked() {
  busy.value = true
  error.value = undefined
  try {
    // The profile the token belongs to is the one being filled in, so its id
    // comes from the server rather than from anything the form holds.
    const profile = await auth.getProfile(api)
    await auth.updateProfile(api, profile.userId, {
      name: name.value,
      phone: phoneNumber.value || undefined,
    })
    router.navigate({ name: 'courses' }, 'root', 'replace')
  } catch {
    error.value = fluent.$t('could-not-save')
  } finally {
    busy.value = false
  }
}
</script>
