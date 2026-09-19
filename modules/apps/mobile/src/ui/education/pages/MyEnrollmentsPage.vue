<template>
  <PageWithHeaderLayout
    :title="$t('my-enrollments-title')"
    :busy="busy"
    :has-data="loaded"
    :is-empty="items.length === 0"
    :empty-text="$t('my-enrollments-empty')"
  >
    <EnrollmentsList :items="items" @click="onEnrollmentClicked" />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useRepositories } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData } from '@/shared'
import { EnrollmentsList, toEnrollmentRows } from '@/ui/education'

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const router = useIonRouter()

// An enrolment carries a course id, not a course name, so the catalogue is read
// alongside it and the two are joined here.
const { data, busy, loaded } = useLocalData(
  async () => ({
    enrollments: await repositories.enrollments.list(),
    courses: await repositories.courses.list(),
  }),
  { enrollments: [], courses: [] },
)

const items = computed(() => toEnrollmentRows(data.value.enrollments, data.value.courses))

/* -------------------------------- Handlers -------------------------------- */

function onEnrollmentClicked(enrollmentId: EnrollmentId) {
  router.push({ name: 'my-enrollment', params: { id: enrollmentId } })
}
</script>
