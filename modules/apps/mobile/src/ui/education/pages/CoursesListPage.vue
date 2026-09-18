<template>
  <PageWithHeaderLayout
    :title="$t('courses-title')"
    :busy="busy"
    :has-data="loaded"
    :is-empty="visibleCourses.length === 0"
    :empty-text="$t('courses-empty')"
    :error="errorMessage"
  >
    <template #toolbar>
      <IonToolbar>
        <IonSearchbar v-model="searchQuery" :placeholder="$t('courses-search')" />
      </IonToolbar>
    </template>

    <CoursesList :items="visibleCourses" @click="onCourseCardClicked" />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { IonSearchbar, IonToolbar, useIonRouter } from '@ionic/vue'
import { computed, ref } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useFailureMessage, useRemoteData } from '@/shared'
import { CoursesList } from '@/ui/education'
import { education } from '@/usecases'

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()
const searchQuery = ref('')

const { data: courses, busy, loaded, failure } = useRemoteData(() => education.listCourses(api), [])

// The API takes no search term, so the catalogue is filtered where it is held.
// Fine while a school runs a handful of courses; a server-side search is a
// recorded deficit.
const errorMessage = useFailureMessage(failure)

const visibleCourses = computed(() => courses.value.filter(matchesQuery))

/* -------------------------------- Handlers -------------------------------- */

function onCourseCardClicked(id: CourseId) {
  router.push({ name: 'course', params: { id } })
}

/* -------------------------------- Helpers --------------------------------- */

function matchesQuery(course: { name: string }): boolean {
  return course.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
}
</script>
