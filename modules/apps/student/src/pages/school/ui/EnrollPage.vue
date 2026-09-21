<script setup lang="ts">
import type { GroupId } from '@vidya/domain'
import { Button, EmptyState, RadioGroup, Skeleton, Textarea } from '@vidya/ui'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { translate } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

import { pickCourseView, useEnrollForm } from '../model'
import { fieldClasses, formClasses } from './styles'
import EnrollTimes from './EnrollTimes.vue'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()
const status = useSiteStatus()

const code = computed(() => String(route.params.code ?? ''))
const courseId = computed(() => String(route.params.courseId ?? ''))

const { course, groups, writable, reading, busy, failed, ask } = useEnrollForm(
  () => code.value,
  () => courseId.value,
)

const preferredGroupId = ref('')
const times = ref<readonly string[]>([])
const comment = ref('')

const view = computed(() =>
  pickCourseView({
    reading: reading.value,
    found: course.value !== null,
    filled: status.firstRunCompleted.value,
  }),
)

// A course taught one student at a time has no groups, and a student who does
// not mind which group they are in has to be able to say so.
const options = computed(() => [
  { value: '', label: translate('enroll-group-any') },
  ...groups.value.map((group) => ({ value: group.id, label: group.name })),
])

/* -------------------------------- Handlers -------------------------------- */

async function onAskClicked() {
  const asked = await ask({
    preferredGroupId: preferredGroupId.value === '' ? null : (preferredGroupId.value as GroupId),
    times: times.value,
    comment: comment.value,
  })

  if (!asked) return

  await router.push({ name: 'place', params: { code: code.value, courseId: courseId.value } })
}
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('enroll-title') }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress
      v-else-if="view === 'arriving'"
      :rows="status.done.value"
      :running="status.syncing.value"
    />

    <EmptyState
      v-else-if="view === 'absent'"
      :title="$t('course-absent-title')"
      :description="$t('course-absent-text')"
    />

    <form v-else :class="formClasses" @submit.prevent="onAskClicked">
      <p :class="mutedClasses">{{ $t('enroll-moderated') }}</p>

      <fieldset v-if="groups.length > 0" :class="fieldClasses">
        <legend>{{ $t('enroll-group-title') }}</legend>
        <p :class="mutedClasses">{{ $t('enroll-group-hint') }}</p>
        <RadioGroup v-model="preferredGroupId" :options="options" />
      </fieldset>

      <fieldset :class="fieldClasses">
        <legend>{{ $t('enroll-time-title') }}</legend>
        <p :class="mutedClasses">{{ $t('enroll-time-hint') }}</p>
        <EnrollTimes v-model:chosen="times" />
      </fieldset>

      <fieldset :class="fieldClasses">
        <legend>{{ $t('enroll-comment-title') }}</legend>
        <Textarea v-model="comment" :rows="3" :placeholder="$t('enroll-comment-hint')" />
      </fieldset>

      <p v-if="!writable" :class="mutedClasses">{{ $t('enroll-elsewhere') }}</p>
      <p v-if="failed" :class="mutedClasses">{{ $t('enroll-failed') }}</p>

      <Button data-test="ask" type="submit" :disabled="!writable || busy" @click="onAskClicked">
        {{ $t('enroll-ask') }}
      </Button>
    </form>
  </section>
</template>
