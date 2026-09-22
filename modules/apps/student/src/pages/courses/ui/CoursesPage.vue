<script setup lang="ts">
import { EmptyState, Input, Skeleton } from '@vidya/ui'
import { computed, ref } from 'vue'

import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, pageClasses, titleClasses } from '@/shared/ui'

import { pickCoursesView, useCourseCards } from '../model'
import CourseCard from './CourseCard.vue'
import { listClasses, searchClasses } from './styles'

// Up to this many courses the list fits the eye and a search field is
// furniture. Counted over everything on offer rather than over what the query
// has left, so the field cannot vanish from under a typing hand.
const SEARCH_SHOWN_ABOVE = 10

/* --------------------------------- State ---------------------------------- */

const status = useSiteStatus()
const { schools, cards, reading } = useCourseCards()
const query = ref('')

const matching = computed(() => {
  const wanted = query.value.trim().toLowerCase()
  return cards.value.filter((card) => card.name.toLowerCase().includes(wanted))
})

const searchable = computed(() => cards.value.length > SEARCH_SHOWN_ABOVE)

const view = computed(() =>
  pickCoursesView({
    reading: reading.value,
    schools: schools.value.length,
    courses: cards.value.length,
    filled: status.firstRunCompleted.value,
    joined: status.joined.value,
  }),
)
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('courses-title') }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress v-else-if="view === 'arriving'" :running="status.syncing.value" />

    <EmptyState
      v-else-if="view === 'uninvited'"
      :title="$t('courses-uninvited-title')"
      :description="$t('courses-uninvited-text')"
    />

    <EmptyState
      v-else-if="view === 'none'"
      :title="$t('courses-none-title')"
      :description="$t('courses-none-text')"
    />

    <template v-else>
      <Input
        v-if="searchable"
        v-model="query"
        :class="searchClasses"
        :placeholder="$t('courses-search')"
        inputmode="search"
      />

      <div :class="listClasses">
        <CourseCard v-for="card in matching" :key="card.id" :card="card" />
      </div>
    </template>
  </section>
</template>
