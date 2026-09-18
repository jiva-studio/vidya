<template>
  <PageWithHeaderLayout
    :title="$t('lesson-title')"
    :busy="busy"
    :has-data="loaded"
    :error="errorMessage"
  >
    <template #toolbar>
      <IonToolbar>
        <LessonSectionsList v-model="selected" :items="sectionViews" />
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
      :answer="answer"
      @submit="onHomeworkSubmitted"
    />
  </PageWithHeaderLayout>
</template>

<script lang="ts" setup>
import type { BlockId, SectionId } from '@vidya/domain'
import type { LessonBlockState } from '@vidya/protocol'
import { IonToolbar } from '@ionic/vue'
import { computed, ref, watch } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useFailureMessage, useRemoteData } from '@/shared'
import { HomeworkAnswer, LessonSectionsList, LessonSectionView } from '@/ui/education'
import { education } from '@/usecases'
import type { LessonPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonPageProps>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const selected = ref(0)
const answer = ref<string | undefined>(undefined)

const { data, busy, loaded, failure, reload } = useRemoteData(
  async () => {
    const version = await education.getPublishedLessonVersion(api, props.lessonId)
    if (!version) return undefined

    const [states, homework] = await Promise.all([
      education.listBlockStates(api, props.enrollmentId, version.id),
      education.listHomeworkOfEnrollment(api, props.enrollmentId),
    ])
    return { version, states, homework }
  },
  undefined,
  { watching: [() => props.enrollmentId, () => props.lessonId] },
)

const errorMessage = useFailureMessage(failure)

const sections = computed(() => data.value?.version.content.sections ?? [])
const selectedSection = computed(() => sections.value[selected.value])

// The strip is a row of labels; everything else about a section is read from
// the section itself once it is the selected one.
const sectionViews = computed(() =>
  sections.value.map((section) => ({ id: section.id, title: section.title })),
)

const blockStates = computed(
  () =>
    Object.fromEntries(
      (data.value?.states ?? []).map((state) => [state.blockId, state.state]),
    ) as Record<BlockId, LessonBlockState>,
)

const selectedHomework = computed(() =>
  selectedSection.value ? homeworkFor(selectedSection.value.id) : undefined,
)

/* --------------------------------- Hooks ---------------------------------- */

// The list answers with summaries, and a summary does not carry the text the
// student already wrote. Without this, work returned for revision opens on an
// empty box and the student retypes it.
watch(
  () => selectedHomework.value?.id,
  async (homeworkId) => {
    answer.value = undefined
    if (!homeworkId) return
    try {
      answer.value = (await education.getHomework(api, homeworkId)).text
    } catch {
      // The section still opens; the box is simply empty, as it was before.
      answer.value = undefined
    }
  },
  { immediate: true },
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
