<template>
  <PageWithHeaderLayout
    :title="$t('lesson')"
    :busy="busy"
    :has-data="loaded"
    :error="failure && $t(failure)"
  >
    <template #toolbar>
      <IonToolbar>
        <LessonSectionsList
          v-model="selected"
          :items="sectionViews"
        />
      </IonToolbar>
    </template>

    <LessonSectionView
      v-if="selectedSection"
      :blocks="selectedSection.blocks"
      :states="blockStates"
      @change="onBlockStateChanged"
    />

    <HomeworkAnswer
      v-if="selectedSection && selectedSection.assessment !== 'none'"
      :status="selectedHomework?.status ?? 'open'"
      @submit="onHomeworkSubmitted"
    />
  </PageWithHeaderLayout>
</template>

<script lang="ts" setup>
import type { BlockId, EnrollmentId, LessonId, SectionId } from '@vidya/domain'
import type { LessonBlockState } from '@vidya/protocol'
import { IonToolbar } from '@ionic/vue'
import { computed, ref } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useRemoteData } from '@/shared'
import { HomeworkAnswer, LessonSectionsList, LessonSectionView } from '@/ui/education'
import { education } from '@/usecases'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ enrollmentId: EnrollmentId; lessonId: LessonId }>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const selected = ref(0)

const { data, busy, loaded, failure, reload } = useRemoteData(async () => {
  const version = await education.getPublishedLessonVersion(api, props.lessonId)
  if (!version) return undefined

  const [states, homework] = await Promise.all([
    education.listBlockStates(api, props.enrollmentId, version.id),
    education.listHomeworkOfEnrollment(api, props.enrollmentId),
  ])
  return { version, states, homework }
}, undefined)

const sections = computed(() => data.value?.version.content.sections ?? [])
const selectedSection = computed(() => sections.value[selected.value])

// The tab strip wants a title and an id; the section carries the rest.
const sectionViews = computed(() =>
  sections.value.map((section) => ({
    id: section.id,
    title: section.title,
    state: homeworkFor(section.id)?.status ?? ('unknown' as const),
    homeworkId: homeworkFor(section.id)?.id,
    blocks: section.blocks,
  })),
)

const blockStates = computed(() =>
  Object.fromEntries(
    (data.value?.states ?? []).map((state) => [state.blockId, state.state]),
  ) as Record<BlockId, LessonBlockState>,
)

const selectedHomework = computed(() =>
  selectedSection.value ? homeworkFor(selectedSection.value.id) : undefined,
)

/* -------------------------------- Handlers -------------------------------- */

async function onBlockStateChanged(blockId: BlockId, state: LessonBlockState) {
  const version = data.value?.version
  if (!version) return
  await education.saveBlockState(api, { lessonVersionId: version.id, blockId, state })
}

async function onHomeworkSubmitted(text: string) {
  const version = data.value?.version
  const section = selectedSection.value
  if (!version || !section) return

  await education.submitHomework(api, {
    lessonVersionId: version.id,
    sectionId: section.id,
    text,
  })
  await reload()
}

/* -------------------------------- Helpers --------------------------------- */

function homeworkFor(sectionId: SectionId) {
  return data.value?.homework.find((item) => item.sectionId === sectionId)
}
</script>

<fluent locale="en">
lesson = Lesson
offline = No connection. The lesson could not be loaded.
unauthorized = Your session has expired. Sign in again.
failed = The lesson could not be loaded.
</fluent>

<fluent locale="ru">
lesson = Урок
offline = Нет соединения. Урок не загрузился.
unauthorized = Сессия истекла. Войдите заново.
failed = Урок не загрузился.
</fluent>
