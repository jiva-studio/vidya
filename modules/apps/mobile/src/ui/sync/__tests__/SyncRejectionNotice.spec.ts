// @vitest-environment jsdom
import { SyncRejectionReasons } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SyncRejectionNotice from '../components/Outbox/SyncRejectionNotice.vue'
import { fluentFor, type Locale } from './fluentFor'

const Locales: readonly Locale[] = ['en', 'ru']

const render = (reason: (typeof SyncRejectionReasons)[number], locale: Locale = 'en') =>
  mount(SyncRejectionNotice, { props: { reason }, global: { plugins: [fluentFor(locale)] } })

const inEveryLocale = SyncRejectionReasons.flatMap((reason) =>
  Locales.map((locale) => [reason, locale] as const),
)

/**
 * A refused answer carries its reason and the promise that the work is
 * still here.
 *
 * The one thing a student has to take away from this screen is that nothing was
 * lost, so the reassurance is part of the notice rather than something a caller
 * may forget to pass.
 *
 * What is checked is that every reason has words of its own in both languages,
 * not which words. Fluent prints the key it could not find, so a message missing
 * from a `.ftl` reaches the student as `sync-rejection-malformed` and fails here;
 * two reasons sharing one text fail as well, because a reason explained with
 * another's words is a reason the screen never actually tells apart. The copy
 * itself is the `.ftl` file's business and is free to change without touching a
 * test.
 */
describe('a refused answer explains itself', () => {
  it.each(inEveryLocale)('explains %s in %s', (reason, locale) => {
    const text = render(reason, locale).text()

    expect(text).not.toContain(reason)
    expect(text.trim().length).toBeGreaterThan(0)
  })

  it.each(Locales)('gives every reason words of its own in %s', (locale) => {
    const texts = SyncRejectionReasons.map((reason) => render(reason, locale).text())

    expect(new Set(texts).size).toBe(SyncRejectionReasons.length)
  })

  it.each(Locales)('promises in %s that the work stays on the device', (locale) => {
    const note = render('enrollmentRevoked', locale).get('ion-note').text()

    expect(note).not.toContain('sync-rejection-kept-on-device')
    expect(note.trim().length).toBeGreaterThan(0)
  })

  it('keeps the reason on the element, because a refusal is a row state', () => {
    expect(render('payloadTooLarge').attributes('data-reason')).toBe('payloadTooLarge')
  })
})
