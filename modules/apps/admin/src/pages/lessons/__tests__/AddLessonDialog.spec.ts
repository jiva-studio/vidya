import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, locale, translate } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import AddLessonDialog from '../ui/AddLessonDialog.vue'

addMessages(messages)
locale.value = 'en'

const COURSE_1 = { id: 'c-1', name: 'Sanskrit 101' }
const COURSE_2 = { id: 'c-2', name: 'Sanskrit 201' }

describe('AddLessonDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('hides course selector when courseId is pre-provided', async () => {
    mountWithApp(AddLessonDialog, {
      attachTo: document.body,
      props: {
        open: true,
        courseId: 'c-1',
        courses: [COURSE_1, COURSE_2],
      },
    })
    await flushPromises()

    expect(document.body.textContent).not.toContain(translate('lesson-create-course-label'))
  })

  it('shows course selector when courseId is not pre-provided', async () => {
    mountWithApp(AddLessonDialog, {
      attachTo: document.body,
      props: {
        open: true,
        courseId: '',
        courses: [COURSE_1, COURSE_2],
      },
    })
    await flushPromises()

    expect(document.body.textContent).toContain(translate('lesson-create-course-label'))
  })

  it('shows validation error when title is empty upon submit', async () => {
    const wrapper = mountWithApp(AddLessonDialog, {
      attachTo: document.body,
      props: {
        open: true,
        courseId: 'c-1',
        courses: [COURSE_1, COURSE_2],
      },
    })
    await flushPromises()

    const submitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === translate('lesson-create-submit'),
    )
    submitBtn?.click()
    await flushPromises()

    expect(document.body.textContent).toContain(translate('lesson-create-title-required'))
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit with title and courseId when valid', async () => {
    const wrapper = mountWithApp(AddLessonDialog, {
      attachTo: document.body,
      props: {
        open: true,
        courseId: 'c-1',
        courses: [COURSE_1, COURSE_2],
      },
    })
    await flushPromises()

    const input = document.body.querySelector('input')
    if (input) {
      input.value = 'Introduction to Devanagari'
      input.dispatchEvent(new Event('input'))
    }
    await flushPromises()

    const submitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === translate('lesson-create-submit'),
    )
    submitBtn?.click()
    await flushPromises()

    expect(wrapper.emitted('submit')).toEqual([['Introduction to Devanagari', 'c-1']])
  })
})
