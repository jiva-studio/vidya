// @vitest-environment jsdom
import { FluentBundle } from '@fluent/bundle'
import type { EnrollmentStatus } from '@vidya/domain'
import { EnrollmentStatuses } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { createFluentVue } from 'fluent-vue'
import { describe, expect, it } from 'vitest'

import EnrollmentsListItem from '../components/Enrollments/EnrollmentsListItem.vue'
import resources from '../i18n'

type Locale = keyof typeof resources

const LOCALES: readonly Locale[] = ['en', 'ru']

// Isolation marks off, so the test compares what a reader would see.
const bundleFor = (locale: Locale): FluentBundle => {
  const bundle = new FluentBundle(locale, { useIsolating: false })
  resources[locale].forEach((resource) => bundle.addResource(resource))

  return bundle
}

const row = (status: EnrollmentStatus, locale: Locale) =>
  mount(EnrollmentsListItem, {
    props: { id: 'e1', courseName: 'Sanskrit grammar', status },
    global: { plugins: [createFluentVue({ bundles: [bundleFor(locale)] })] },
  })

/**
 * The row builds its message key from the status, so a state with no text of
 * its own reaches the student as the identifier itself.
 */
describe('the state of a request in the list', () => {
  it('has a text for every state, in both languages', () => {
    for (const locale of LOCALES) {
      const bundle = bundleFor(locale)
      const missing = EnrollmentStatuses.map((status) => `enrollment-status-${status}`).filter(
        (key) => !bundle.hasMessage(key),
      )

      expect([locale, missing]).toEqual([locale, []])
    }
  })

  it('tells a student who left the course apart from one whose place was taken', () => {
    for (const locale of LOCALES) {
      const bundle = bundleFor(locale)

      expect([locale, bundle.hasMessage('enrollment-status-withdrawn')]).toEqual([locale, true])
      expect(row('withdrawn', locale).text()).not.toBe(row('revoked', locale).text())
    }
  })

  it('never shows the student the identifier instead', () => {
    for (const locale of LOCALES) {
      for (const status of EnrollmentStatuses) {
        expect(row(status, locale).text()).not.toContain(`enrollment-status-${status}`)
      }
    }
  })

  it('reads each state differently from the others', () => {
    for (const locale of LOCALES) {
      const texts = EnrollmentStatuses.map((status) => row(status, locale).text())

      expect(new Set(texts).size).toBe(EnrollmentStatuses.length)
    }
  })
})
