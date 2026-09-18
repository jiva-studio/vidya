<template>
  <PageWithHeaderLayout
    :title="$t('enroll-title')"
    :has-padding="true"
    :has-data="true"
    :error="error"
  >
    <h2>{{ $t('enroll-title') }}</h2>
    <p>{{ $t('enroll-moderated') }}</p>

    <AsyncButton :busy="busy" expand="block" @click="onEnrollButtonClicked">
      {{ $t('enroll-title') }}
    </AsyncButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { ref } from 'vue'

import { useApi } from '@/app'
import { AsyncButton, PageWithHeaderLayout } from '@/design'
import { education } from '@/usecases'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ courseId: CourseId }>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()
const fluent = useFluent()
const busy = ref(false)
const error = ref<string | undefined>(undefined)

/* -------------------------------- Handlers -------------------------------- */

// Enrolment is a request, not a booking: the school decides, and it assigns the
// group afterwards. There is nothing for the student to choose here.
async function onEnrollButtonClicked() {
  busy.value = true
  error.value = undefined
  try {
    await education.requestEnrollment(api, props.courseId)
    router.navigate({ name: 'enroll-completed' }, 'none', 'pop')
  } catch {
    error.value = fluent.$t('enroll-failed')
  } finally {
    busy.value = false
  }
}
</script>
