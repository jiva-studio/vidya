<template>
  <PageWithHeaderLayout
    :title="$t('courses-title')"
    :busy="busy"
    :has-data="loaded"
    :is-empty="isEmpty"
    :empty-text="$t('courses-empty')"
  >
    <template #toolbar>
      <IonToolbar>
        <IonSearchbar v-model="searchQuery" :placeholder="$t('courses-search')" />
      </IonToolbar>
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

import { useRepositories, useSyncStatus } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData, useNetworkStatus } from '@/shared'
import { CoursesList, toCourseCards } from '@/ui/education'
import { BackfillProgress, OfflineBanner } from '@/ui/sync'

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const { syncing, firstRunCompleted, done, total } = useSyncStatus()
const { connected } = useNetworkStatus()
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

// Until the device has been filled once, an empty catalogue is not an answer —
// it says the school has no courses when nothing has been downloaded yet.
const filling = computed(() => !firstRunCompleted.value)
const firstRunBlocked = computed(() => filling.value && !connected.value)
const isEmpty = computed(() => !filling.value && visibleCourses.value.length === 0)

/* -------------------------------- Handlers -------------------------------- */

function onCourseCardClicked(id: CourseId) {
  router.push({ name: 'course', params: { id } })
}

/* -------------------------------- Helpers --------------------------------- */

function matchesQuery(course: { name: string }): boolean {
  return course.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
}
</script>
