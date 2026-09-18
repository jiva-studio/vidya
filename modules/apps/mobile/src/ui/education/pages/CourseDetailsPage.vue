<template>
  <PageWithHeaderLayout
    :title="course?.name ?? ''"
    :busy="busy"
    :has-data="loaded"
    :error="failure && $t(failure)"
    :has-padding="true"
  >
    <p v-if="course?.description">{{ course.description }}</p>

    <IonButton expand="block" @click="onEnrollButtonClicked">
      {{ $t('enroll') }}
    </IonButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { IonButton, useIonRouter } from '@ionic/vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useRemoteData } from '@/shared'
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

/* -------------------------------- Handlers -------------------------------- */

function onEnrollButtonClicked() {
  router.push({ name: 'enroll', params: { id: props.id } })
}
</script>

<fluent locale="en">
enroll = Enroll
offline = No connection. The course could not be loaded.
unauthorized = Your session has expired. Sign in again.
failed = The course could not be loaded.
</fluent>

<fluent locale="ru">
enroll = Записаться
offline = Нет соединения. Курс не загрузился.
unauthorized = Сессия истекла. Войдите заново.
failed = Курс не загрузился.
</fluent>
