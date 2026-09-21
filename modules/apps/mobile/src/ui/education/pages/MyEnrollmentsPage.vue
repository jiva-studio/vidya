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

    <EnrollmentsList
      :items="items"
      @click="onEnrollmentClicked"
      @action="onEnrollmentActionRequested"
    />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { EnrollmentId, GroupId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { asId } from '@vidya/domain'
import { computed } from 'vue'

import { useConnections, useRepositories, useSyncStatus } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import type { LocalEnrollment, LocalGroup } from '@vidya/client'
import { useLocalData, useNetworkStatus } from '@/shared'
import {
  type EnrollmentActionView,
  EnrollmentsList,
  toEnrollmentRows,
  useEnrollmentActions,
} from '@/ui/education'
import { BackfillProgress, OfflineBanner, SignInAgainNotice } from '@/ui/sync'

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const { syncing, firstRunCompleted, done, total } = useSyncStatus()
const { connected } = useNetworkStatus()
const { awaitingSignIn } = useConnections()
const router = useIonRouter()

async function readGroupsOf(enrollments: readonly LocalEnrollment[]): Promise<LocalGroup[]> {
  const ids = [...new Set(enrollments.flatMap((item) => (item.groupId ? [item.groupId] : [])))]
  const found = await Promise.all(ids.map((id) => repositories.groups.getById(asId<GroupId>(id))))

  return found.filter((group) => group !== null)
}

// An enrolment carries ids, not names, so the catalogue and the groups the
// student was placed in are read alongside it and the three are joined here.
const { data, busy, loaded, reload } = useLocalData(
  async () => {
    const enrollments = await repositories.enrollments.list()

    return {
      enrollments,
      courses: await repositories.courses.list(),
      groups: await readGroupsOf(enrollments),
    }
  },
  { enrollments: [], courses: [], groups: [] },
)

const items = computed(() =>
  toEnrollmentRows(data.value.enrollments, data.value.courses, data.value.groups),
)

// A write is read back by this screen rather than waited for: the next run is
// seconds away behind its debounce, and until then the row the student just
// put away would still be sitting in the list.
const actions = useEnrollmentActions(repositories.enrollments, reload)

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

function onEnrollmentActionRequested(enrollmentId: EnrollmentId, action: EnrollmentActionView) {
  void actions.confirmAndRun(enrollmentId, action)
}
</script>
