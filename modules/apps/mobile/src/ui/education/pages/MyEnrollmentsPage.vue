<template>
  <PageWithHeaderLayout
    :title="$t('my-enrollments-title')"
    :back-href="null"
    :busy="busy"
    :has-data="loaded"
    :is-empty="isEmpty"
    :empty-text="$t('my-enrollments-empty')"
  >
    <template #notice>
      <SignInAgainNotice
        v-if="awaitingSignIn.length > 0"
        :schools="awaitingSignIn.length"
        @sign-in="onSignInAgainClicked"
      />
    </template>

    <OfflineBanner v-if="firstRunBlocked" :online="connected" :syncing="syncing" />
    <BackfillProgress v-else-if="filling" :done="done" :total="total" />

    <EnrollmentsList :items="items" @click="onEnrollmentClicked" />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useConnections, useRepositories, useSyncStatus } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData, useNetworkStatus } from '@/shared'
import { EnrollmentsList, toEnrollmentRows } from '@/ui/education'
import { BackfillProgress, OfflineBanner, SignInAgainNotice } from '@/ui/sync'

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const { syncing, firstRunCompleted, done, total } = useSyncStatus()
const { connected } = useNetworkStatus()
const { awaitingSignIn } = useConnections()
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

// Until the device has been filled once, an empty list is not an answer: it
// tells a student who has just applied that they never applied at all.
const filling = computed(() => !firstRunCompleted.value)
const firstRunBlocked = computed(() => filling.value && !connected.value)
const isEmpty = computed(() => !filling.value && items.value.length === 0)

/* -------------------------------- Handlers -------------------------------- */

function onSignInAgainClicked() {
  router.navigate({ name: 'signin' }, 'root', 'replace')
}

function onEnrollmentClicked(enrollmentId: EnrollmentId) {
  router.push({ name: 'my-enrollment', params: { id: enrollmentId } })
}
</script>
