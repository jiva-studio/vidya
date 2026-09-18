<template>
  <PageWithHeaderLayout
    :title="course?.name ?? ''"
    :busy="busy"
    :has-data="loaded"
    :error="errorMessage"
    :has-padding="true"
  >
    <p v-if="course?.description">{{ course.description }}</p>

    <IonButton expand="block" @click="onEnrollButtonClicked">
      {{ $t('course-enroll') }}
    </IonButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { IonButton, useIonRouter } from '@ionic/vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useFailureMessage, useRemoteData } from '@/shared'
import { education } from '@/usecases'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ id: CourseId }>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()

const {
  data: course,
  busy,
  loaded,
  failure,
} = useRemoteData(() => education.getCourse(api, props.id), undefined)

const errorMessage = useFailureMessage(failure)

/* -------------------------------- Handlers -------------------------------- */

function onEnrollButtonClicked() {
  router.push({ name: 'enroll', params: { id: props.id } })
}
</script>
