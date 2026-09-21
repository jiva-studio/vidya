<script setup lang="ts">
import { isLive } from '@vidya/domain'
import { EmptyState, Skeleton } from '@vidya/ui'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useSiteStatus } from '@/shared/status'
import { useDeviceWrites } from '@/shared/sync'
import { BackfillProgress, mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

import { pickPlaceView, usePlaceView } from '../model'
import type { PlaceActionName } from '../types'
import PlaceDispatch from './PlaceDispatch.vue'
import PlaceSummary from './PlaceSummary.vue'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const status = useSiteStatus()
const writes = useDeviceWrites()

const code = computed(() => String(route.params.code ?? ''))
const courseId = computed(() => String(route.params.courseId ?? ''))

const { course, place, group, preferredGroup, reading, reload } = usePlaceView(
  () => code.value,
  () => courseId.value,
)

const busy = ref(false)
const failed = ref(false)

const view = computed(() =>
  pickPlaceView({
    reading: reading.value,
    found: place.value !== null,
    filled: status.firstRunCompleted.value,
  }),
)

const writable = computed(() => writes.enrollments.value !== undefined)

const putAway = computed(() => place.value !== null && place.value.archivedByStudentAt !== null)

// A request that has ended is asked again by making a new one; a live one is
// answered rather than repeated, and the device keeps one live place per
// course whatever a screen offers.
const canAskAgain = computed(() => place.value !== null && !isLive(place.value.status))

const askAgain = computed(() => ({
  name: 'enroll',
  params: { code: code.value, courseId: courseId.value },
}))

/* -------------------------------- Handlers -------------------------------- */

// The guard is the first statement rather than a state of the button: a second
// click lands before the render that disables it, and withdrawing twice would
// journal a second row saying what the first one said.
async function onAct(action: PlaceActionName) {
  const enrollments = writes.enrollments.value
  const held = place.value
  if (busy.value || enrollments === undefined || held === null) return

  busy.value = true
  failed.value = false

  try {
    await enrollments[action](held.id)
    await reload()
  } catch (error) {
    console.warn('the answer to the request could not be written', error)
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('place-title') }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress v-else-if="view === 'arriving'" :running="status.syncing.value" />

    <EmptyState
      v-else-if="view === 'absent'"
      :title="$t('place-absent-title')"
      :description="$t('place-absent-text')"
    />

    <template v-else-if="place">
      <p v-if="course">{{ $t('place-course') }}: {{ course.name }}</p>

      <PlaceSummary :place="place" :group="group" :preferred-group="preferredGroup" />

      <p v-if="putAway" :class="mutedClasses">{{ $t('place-put-away') }}</p>

      <PlaceDispatch v-if="writable" :place="place" :busy="busy" @act="onAct" />
      <p v-else :class="mutedClasses">{{ $t('place-elsewhere') }}</p>

      <p v-if="failed" :class="mutedClasses">{{ $t('place-act-failed') }}</p>

      <RouterLink v-if="canAskAgain" :to="askAgain">{{ $t('place-ask-again') }}</RouterLink>
    </template>
  </section>
</template>
