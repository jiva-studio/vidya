// @vitest-environment jsdom
import { FluentBundle } from '@fluent/bundle'
import { IonPickerColumn, IonPickerColumnOption } from '@ionic/vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createFluentVue } from 'fluent-vue'
import { describe, expect, it } from 'vitest'

import sharedResources from '@/shared/i18n'

import TimePicker from '../components/TimePicker.vue'

function fluentPlugin() {
  const bundle = new FluentBundle('en', { useIsolating: false })
  sharedResources.en.forEach((resource) => bundle.addResource(resource))

  return createFluentVue({ bundles: [bundle] })
}

const render = (props: Record<string, unknown> = {}): VueWrapper =>
  mount(TimePicker, { props, global: { plugins: [fluentPlugin()] } })

const END_OF_DAY = 1440

const column = (wrapper: VueWrapper, which: 'start' | 'end') => {
  const found = wrapper
    .findAllComponents(IonPickerColumn)
    .find((candidate) => candidate.attributes('data-testid') === `time-picker-${which}`)

  if (found === undefined) throw new Error(`the picker has no ${which} column`)

  return found
}

const optionsOf = (wrapper: VueWrapper, which: 'start' | 'end') =>
  column(wrapper, which)
    .findAllComponents(IonPickerColumnOption)
    .map((option) => ({ value: option.props('value') as number, label: option.text() }))

const choose = (wrapper: VueWrapper, which: 'start' | 'end', minute: number) =>
  column(wrapper, which).vm.$emit('ionChange', { detail: { value: minute } })

const confirm = (wrapper: VueWrapper) =>
  wrapper.find('[data-testid="time-picker-confirm"]').trigger('click')

const confirmed = (wrapper: VueWrapper) =>
  wrapper.emitted('confirm')?.at(-1)?.[0] as { startMinute: number; endMinute: number } | undefined

/**
 * The end of a day is midnight at its far side, and a picker has to be able to
 * say so.
 *
 * Offering hours 00:00 to 23:00 for both ends leaves "until midnight"
 * unsayable: a student who is free all evening can pick 23:00 and lose the last
 * hour, or pick 00:00 and describe a stretch that ends before it starts. One
 * minute count past the day, 1440, says the thing itself, and it is the same
 * number the request carries.
 */
describe('a picker that can name the end of the day', () => {
  it('offers midnight at the far end of the day as 24:00', () => {
    expect(optionsOf(render(), 'end')).toContainEqual({ value: END_OF_DAY, label: '24:00' })
  })

  it('never offers the end of the day as a beginning', () => {
    expect(optionsOf(render(), 'start').map((option) => option.value)).not.toContain(END_OF_DAY)
  })

  it('hands back 1440 rather than an hour that does not exist', async () => {
    const wrapper = render({ startMinute: 1080, endMinute: 1320 })

    await choose(wrapper, 'end', END_OF_DAY)
    await confirm(wrapper)

    expect(confirmed(wrapper)).toEqual({ startMinute: 1080, endMinute: END_OF_DAY })
  })
})

/**
 * Tapping an interval that is already on the list opens this picker on it, so
 * the picker has to start where the interval does and hand back the untouched
 * end unchanged. A picker that always opens on its own default turns every
 * correction into retyping both ends.
 */
describe('a picker opened on an interval that already exists', () => {
  it('starts on the interval it was handed rather than on a default', () => {
    const wrapper = render({ startMinute: 600, endMinute: END_OF_DAY })

    expect(column(wrapper, 'start').props('value')).toBe(600)
    expect(column(wrapper, 'end').props('value')).toBe(END_OF_DAY)
  })

  it('carries back the end nobody touched', async () => {
    const wrapper = render({ startMinute: 600, endMinute: 1080 })

    await choose(wrapper, 'start', 540)
    await confirm(wrapper)

    expect(confirmed(wrapper)).toEqual({ startMinute: 540, endMinute: 1080 })
  })

  it('says nothing at all when it is dismissed', async () => {
    const wrapper = render({ startMinute: 600, endMinute: 1080 })

    await choose(wrapper, 'start', 540)
    await wrapper.find('[data-testid="time-picker-cancel"]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
