import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CourseFormValues } from '@/entities/course'
import { addMessages, locale } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import CourseForm from '../ui/CourseForm.vue'

addMessages(messages)
locale.value = 'en'

const sampleFormValues: CourseFormValues = {
  name: 'Bhakti Shastri',
  description: 'A comprehensive study of scripture',
  learningType: 'group',
  status: 'draft',
  coverImageUrl: null,
}

describe('CourseForm', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders all form fields including cover image field', () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: sampleFormValues,
      },
    })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)
    // Cover image field or container should exist
    const coverField = wrapper.find(
      '[data-test="course-cover-field"], [name="coverImageUrl"], .cover-field, img',
    )
    const hasCoverField = coverField.exists() || wrapper.text().toLowerCase().includes('cover')
    expect(hasCoverField).toBe(true)
  })

  it('emits update:modelValue with updated name when name is edited', async () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: sampleFormValues,
      },
    })

    const input = wrapper.find('input')
    await input.setValue('New Course Name')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([
      { ...sampleFormValues, name: 'New Course Name' },
    ])
  })

  it('emits update:modelValue with updated coverImageUrl when cover image is changed', async () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: sampleFormValues,
      },
    })

    // Find cover field component or trigger
    const coverComponent = wrapper.findComponent({ name: 'CourseCoverField' })
    if (coverComponent.exists()) {
      coverComponent.vm.$emit('update:modelValue', 'https://cdn.example.com/new-cover.jpg')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([
        { ...sampleFormValues, coverImageUrl: 'https://cdn.example.com/new-cover.jpg' },
      ])
    } else {
      // If CourseCoverField is not yet integrated, this test fails
      expect(coverComponent.exists()).toBe(true)
    }
  })

  it('renders existing coverImageUrl when passed in modelValue', () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: {
          ...sampleFormValues,
          coverImageUrl: 'https://cdn.example.com/existing-cover.jpg',
        },
      },
    })

    const coverComponent = wrapper.findComponent({ name: 'CourseCoverField' })
    if (coverComponent.exists()) {
      expect(coverComponent.props('modelValue')).toBe('https://cdn.example.com/existing-cover.jpg')
    } else {
      expect(wrapper.find('img[src="https://cdn.example.com/existing-cover.jpg"]').exists()).toBe(
        true,
      )
    }
  })

  it('emits submit when valid form is submitted', async () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: {
          ...sampleFormValues,
          coverImageUrl: 'https://cdn.example.com/valid-cover.jpg',
        },
      },
    })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('does not emit submit and shows error when name is blank', async () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: {
          ...sampleFormValues,
          name: '',
        },
      },
    })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.text()).toContain('Enter a name.')
  })

  it('emits cancel when cancel button is clicked', async () => {
    const wrapper = mountWithApp(CourseForm, {
      props: {
        modelValue: sampleFormValues,
      },
    })

    const cancelBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Cancel')
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
