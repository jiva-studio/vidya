// @vitest-environment jsdom
import { SyncRejectionReasons } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SyncRejectionNotice from '../components/Outbox/SyncRejectionNotice.vue'
import { fluentFor, type Locale } from './fluentFor'

const render = (reason: (typeof SyncRejectionReasons)[number], locale: Locale = 'en') =>
  mount(SyncRejectionNotice, { props: { reason }, global: { plugins: [fluentFor(locale)] } })

const keptOnDevice: Record<Locale, string> = {
  en: 'saved on this device',
  ru: 'сохранена на устройстве',
}

/**
 * T-U-2, AC-23. A refused answer carries its reason and the promise that the
 * work is still here.
 *
 * The one thing a student has to take away from this screen is that nothing was
 * lost, so the reassurance is part of the notice rather than something a caller
 * may forget to pass.
 */
describe('T-U-2: a refused answer explains itself', () => {
  it.each(SyncRejectionReasons)('says in plain words why %s happened', (reason) => {
    const text = render(reason).text()

    expect(text).not.toContain(reason)
    expect(text.length).toBeGreaterThan(0)
  })

  it.each(['en', 'ru'] as const)('translates every reason into %s', (locale) => {
    const texts = SyncRejectionReasons.map((reason) => render(reason, locale).text())

    expect(new Set(texts).size).toBe(SyncRejectionReasons.length)
  })

  it.each(['en', 'ru'] as const)('promises in %s that the work stays on the device', (locale) => {
    const text = render('enrollmentRevoked', locale).text().toLowerCase()

    expect(text).toContain(keptOnDevice[locale])
  })

  it('keeps the reason on the element, because a refusal is a row state', () => {
    expect(render('payloadTooLarge').attributes('data-reason')).toBe('payloadTooLarge')
  })
})
