<template>
  <PageWithHeaderLayout
    :title="course?.name ?? ''"
    :busy="busy"
    :has-data="loaded"
    :has-padding="true"
  >
    <p v-if="course?.description">{{ course.description }}</p>

    <IonButton expand="block" @click="onEnrollButtonClicked">
      {{ $t('course-enroll') }}
    </IonButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import { IonButton, useIonRouter } from '@ionic/vue'

import { useRepositories } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData } from '@/shared'

import type { CourseDetailsPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CourseDetailsPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const router = useIonRouter()

const {
  data: course,
  busy,
  loaded,
} = useLocalData(() => repositories.courses.getById(props.id), null, { watching: [() => props.id] })

/* -------------------------------- Handlers -------------------------------- */

function onEnrollButtonClicked() {
  router.push({ name: 'enroll', params: { id: props.id } })
}
</script>
