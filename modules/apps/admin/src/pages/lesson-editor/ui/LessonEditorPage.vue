<script setup lang="ts">
import type { CourseId, LessonId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Toaster } from '@vidya/ui'
import { provide } from 'vue'

import { getLesson, renameLesson } from '@/entities/lesson'
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

// The name is saved as it is typed, like the document below it. A failure
// leaves what the author wrote on screen; the next keystroke tries again.
async function onRename(next: string) {
  title.value = next

  try {
    await renameLesson(http, lessonId, next)
  } catch {
    // The heading keeps what was typed: the lesson is still open and still
    // editable, and an error here must not take the words away.
  }
}

function onBack() {
  void router.push({ name: 'lessons', query: { courseId: String(courseId) } })
}
</script>

<template>
  <section :class="pageClasses">
    <LessonEditorView :lesson-id="lessonId" :title="title" @back="onBack" @rename="onRename" />
    <Toaster :toasts="toasts.items.value" @dismiss="toasts.dismiss" />
  </section>
</template>
