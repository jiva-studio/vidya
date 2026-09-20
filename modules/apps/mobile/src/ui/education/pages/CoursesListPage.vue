<template>
  <PageWithHeaderLayout
    :title="$t('courses-title')"
    :back-href="null"
    :busy="busy"
    :has-data="loaded"
    :is-empty="isEmpty"
    :empty-text="$t('courses-empty')"
  >
    <template v-if="searchable" #toolbar>
      <IonToolbar>
        <IonSearchbar v-model="searchQuery" :placeholder="$t('courses-search')" />
      </IonToolbar>
    </template>

    <template #notice>
      <SignInAgainNotice
        v-if="awaitingSignIn.length > 0"
        :schools="awaitingSignIn.length"
        @sign-in="onSignInAgainClicked"
      />
    </template>

    <OfflineBanner v-if="firstRunBlocked" :online="connected" :syncing="syncing" />
    <BackfillProgress v-else-if="filling" :done="done" :total="total" />

    <CoursesList :items="visibleCourses" @click="onCourseCardClicked" />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { IonSearchbar, IonToolbar, useIonRouter } from '@ionic/vue'
import { computed, ref } from 'vue'

import { useConnections, useRepositories, useSyncStatus } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData, useNetworkStatus } from '@/shared'
import { CoursesList, toCourseCards } from '@/ui/education'
import { BackfillProgress, OfflineBanner, SignInAgainNotice } from '@/ui/sync'

// Up to this many courses the catalogue fits the eye, and a search field is
// furniture. Counted over everything the device holds rather than over what the
// current query left, so the field cannot disappear from under a typing hand.
const SEARCH_SHOWN_ABOVE = 10

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const { syncing, firstRunCompleted, done, total } = useSyncStatus()
const { connected } = useNetworkStatus()
const { awaitingSignIn } = useConnections()
const router = useIonRouter()
const searchQuery = ref('')

const { data, busy, loaded } = useLocalData(
  async () => ({
    courses: await repositories.courses.list(),
    schools: await repositories.schools.list(),
  }),
  { courses: [], schools: [] },
)

const cards = computed(() => toCourseCards(data.value.courses, data.value.schools))

// The catalogue takes no search term from anywhere: it is what the device
// holds, and filtering it is a property of the screen.
const visibleCourses = computed(() => cards.value.filter(matchesQuery))

const searchable = computed(() => cards.value.length > SEARCH_SHOWN_ABOVE)

// Until the device has been filled once, an empty catalogue is not an answer —
// it says the school has no courses when nothing has been downloaded yet.
const filling = computed(() => !firstRunCompleted.value)
const firstRunBlocked = computed(() => filling.value && !connected.value)
const isEmpty = computed(() => !filling.value && visibleCourses.value.length === 0)

/* -------------------------------- Handlers -------------------------------- */

function onSignInAgainClicked() {
  router.navigate({ name: 'signin' }, 'root', 'replace')
}

function onCourseCardClicked(id: CourseId) {
  router.push({ name: 'course', params: { id } })
}

/* -------------------------------- Helpers --------------------------------- */

function matchesQuery(course: { name: string }): boolean {
  return course.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
}
</script>
