<template>
  <PageWithHeaderLayout
    :title="$t('my-enrollment')"
    :busy="busy"
    :has-data="loaded"
    :error="failure && $t(failure)"
  >
    <EnrollmentReviewStatus
      v-if="enrollment && enrollment.status !== 'accepted'"
      :image="`enrollment/${enrollment.status}.webp`"
      :header="$t(`enrollment-${enrollment.status}`)"
      :text="$t(`enrollment-${enrollment.status}-summary`)"
      :action-text="$t('go-back')"
      @click="onStatusButtonClicked"
    />

    <LessonsList
      v-else-if="enrollment"
      :items="lessons"
      @click="onLessonClicked"
    />
  </PageWithHeaderLayout>
</template>

<script lang="ts" setup>
import type { EnrollmentId, LessonId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useRemoteData } from '@/shared'
import { EnrollmentReviewStatus, LessonsList } from '@/ui/education'
import { education } from '@/usecases'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ enrollmentId: EnrollmentId }>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()

// Lessons belong to the course, not to the group: an accepted student reads
// them while still waiting to be placed.
const { data, busy, loaded, failure } = useRemoteData(async () => {
  const enrollment = await education.getEnrollment(api, props.enrollmentId)
  const lessons =
    enrollment.status === 'accepted'
      ? await education.listLessonsOfCourse(api, enrollment.courseId)
      : []
  return { enrollment, lessons }
}, undefined)

const enrollment = computed(() => data.value?.enrollment)
const lessons = computed(() => data.value?.lessons ?? [])

/* -------------------------------- Handlers -------------------------------- */

function onStatusButtonClicked() {
  router.back()
}

function onLessonClicked(lessonId: LessonId) {
  router.push({ name: 'lesson', params: { lessonId } })
}
</script>

<fluent locale="en">
my-enrollment = Enrolment
go-back = Go back
enrollment-pending = Request pending
enrollment-pending-summary = The school will look at it shortly.
enrollment-declined = Request declined
enrollment-declined-summary = No reason was given.
offline = No connection. The enrolment could not be loaded.
unauthorized = Your session has expired. Sign in again.
failed = The enrolment could not be loaded.
</fluent>

<fluent locale="ru">
my-enrollment = Заявка
go-back = Назад
enrollment-pending = Заявка на рассмотрении
enrollment-pending-summary = Школа рассмотрит её в ближайшее время.
enrollment-declined = Заявка отклонена
enrollment-declined-summary = Причина не указана.
offline = Нет соединения. Заявка не загрузилась.
unauthorized = Сессия истекла. Войдите заново.
failed = Заявка не загрузилась.
</fluent>
