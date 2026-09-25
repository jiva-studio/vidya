import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { addMessages, locale } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import LessonsCourseFilter from '../ui/LessonsCourseFilter.vue'
import LessonsFilters from '../ui/LessonsFilters.vue'

addMessages(messages)
locale.value = 'en'

const COURSE_OPTIONS = [
  { value: 'c-1', label: 'Course 1' },
  { value: 'c-2', label: 'Course 2' },
]

describe('LessonsFilters', () => {
  it('emits update:courseId when course filter changes', async () => {
    const wrapper = mountWithApp(LessonsFilters, {
      props: {
        search: '',
        courseId: '',
        courseOptions: COURSE_OPTIONS,
        filtersApplied: false,
      },
    })

    const courseFilter = wrapper.findComponent(LessonsCourseFilter)
    courseFilter.vm.$emit('update:modelValue', 'c-1')
    await flushPromises()

    expect(wrapper.emitted('update:courseId')).toEqual([['c-1']])
  })

  it('emits clear when clear event is triggered', async () => {
    const wrapper = mountWithApp(LessonsFilters, {
      props: {
        search: 'Devanagari',
        courseId: 'c-1',
        courseOptions: COURSE_OPTIONS,
        filtersApplied: true,
      },
    })

    const clearButton = wrapper.find('button')
    await clearButton.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('clear')).toBeTruthy()
  })
})
