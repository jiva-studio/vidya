<template>
  <PageWithHeaderLayout
    :title="$t('courses')"
    :busy="busy"
    :has-data="loaded"
    :is-empty="visibleCourses.length === 0"
    :empty-text="$t('nothing-found')"
    :error="failure && $t(failure)"
  >
    <template #toolbar>
      <IonToolbar>
        <IonSearchbar
          v-model="searchQuery"
          :placeholder="$t('search')"
        />
      </IonToolbar>
    </template>

    <CoursesList
      :items="visibleCourses"
      @click="onCourseCardClicked"
    />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId } from '@vidya/domain'
import { IonSearchbar, IonToolbar, useIonRouter } from '@ionic/vue'
import { computed, ref } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useRemoteData } from '@/shared'
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

<fluent locale="en">
courses = Courses
search = Search
nothing-found = No courses here yet
offline = No connection. The catalogue could not be loaded.
unauthorized = Your session has expired. Sign in again.
failed = The catalogue could not be loaded.
</fluent>

<fluent locale="ru">
courses = Курсы
search = Поиск
nothing-found = Курсов пока нет
offline = Нет соединения. Каталог не загрузился.
unauthorized = Сессия истекла. Войдите заново.
failed = Каталог не загрузился.
</fluent>
