<script setup lang="ts">
import type { CourseId, LessonId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Toaster } from '@vidya/ui'
import { provide } from 'vue'

import { getLesson } from '@/entities/lesson'
import { useHttp } from '@/shared/api'
import { createToasts, toastsKey } from '@/shared/lib'
import { LessonEditorView } from '@/widgets/lesson-editor'

import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()
const http = useHttp()

const courseId = asId<CourseId>(String(route.params.courseId ?? ''))
const lessonId = asId<LessonId>(String(route.params.lessonId ?? ''))

const title = ref<string | undefined>(undefined)

// Anything on this screen announces here; the stack belongs to the page so two
// blocks uploading do not raise two of them.
const toasts = createToasts()
provide(toastsKey, toasts)

/* --------------------------------- Hooks ---------------------------------- */

// The name of the lesson is a courtesy, not the screen: the editor works
// whether or not it arrives, so a failure here leaves the heading generic
// rather than turning a working editor into an error page.
onMounted(async () => {
  try {
    title.value = (await getLesson(http, lessonId)).title
  } catch {
    title.value = undefined
  }
})

/* -------------------------------- Handlers -------------------------------- */

function onBack() {
  void router.push({ name: 'lessons', params: { courseId } })
}
</script>

<template>
  <section :class="pageClasses">
    <LessonEditorView :lesson-id="lessonId" :title="title" @back="onBack" />
    <Toaster :toasts="toasts.items.value" @dismiss="toasts.dismiss" />
  </section>
</template>
