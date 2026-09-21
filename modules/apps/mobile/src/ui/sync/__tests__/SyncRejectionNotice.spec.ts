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
 * The subject each reason has to be about, in each language.
 *
 * Not the message itself — repeating the `.ftl` here would only prove that two
 * files were edited together. What is pinned is the *substance*: the word a
 * student needs to see to understand which of the seven things went wrong.
 * Swap two messages in the `.ftl` and the pairing breaks, which is the whole
 * point: an answer refused for its length must not be explained as somebody
 * else's enrolment.
 */
const about: Record<(typeof SyncRejectionReasons)[number], Record<Locale, RegExp>> = {
  readOnlyCollection: {
    en: /cannot be sent from the app/i,
    ru: /нельзя отправлять из приложения/i,
  },
  notYourEnrollment: { en: /not yours/i, ru: /чужой записи/i },
  enrollmentRevoked: { en: /no longer enrolled/i, ru: /больше не записаны/i },
  scopeRevoked: { en: /took away your access/i, ru: /сняла с вас доступ/i },
  unknownLessonVersion: { en: /lesson version/i, ru: /версию урока/i },
  alreadyAccepted: { en: /already been accepted/i, ru: /уже принят/i },
  underReview: { en: /teacher has this work open/i, ru: /смотрит преподаватель/i },
  courseNotOffered: { en: /not taking students onto this course/i, ru: /не набирает на этот курс/i },
  payloadTooLarge: { en: /too long/i, ru: /слишком длинный/i },
  malformed: { en: /could not read/i, ru: /не смогла прочитать/i },
}

/**
 * A refused answer carries its reason and the promise that the
 * work is still here.
 *
 * The one thing a student has to take away from this screen is that nothing was
 * lost, so the reassurance is part of the notice rather than something a caller
 * may forget to pass.
 */
describe('a refused answer explains itself', () => {
  it.each(SyncRejectionReasons)('says in plain words why %s happened', (reason) => {
    const text = render(reason).text()

    expect(text).not.toContain(reason)
    expect(text.length).toBeGreaterThan(0)
  })

  it.each(
    SyncRejectionReasons.flatMap((reason) =>
      (['en', 'ru'] as const).map((locale) => [reason, locale] as const),
    ),
  )('explains %s in %s by what actually happened', (reason, locale) => {
    expect(render(reason, locale).text()).toMatch(about[reason][locale])
  })

  it.each(['en', 'ru'] as const)('translates every reason into %s', (locale) => {
    const texts = SyncRejectionReasons.map((reason) => render(reason, locale).text())

    expect(new Set(texts).size).toBe(SyncRejectionReasons.length)
  })

  it.each(['en', 'ru'] as const)('promises in %s that the work stays on the device', (locale) => {
    const text = render('enrollmentRevoked', locale).text().toLowerCase()

    expect(text).toContain(keptOnDevice[locale])
  })

  it.each(['en', 'ru'] as const)(
    'tells a lost place from a lost role in %s, which is why they are two reasons',
    (locale) => {
      const revokedRole = render('scopeRevoked', locale).text()
      const revokedPlace = render('enrollmentRevoked', locale).text()

      // A place on a course ending and the school taking a role away are
      // different events with different answers for the student, and the
      // screen is the only place that difference reaches them. Explained with
      // one another's words, the second reason buys nothing.
      expect(revokedRole).not.toMatch(about.enrollmentRevoked[locale])
      expect(revokedPlace).not.toMatch(about.scopeRevoked[locale])
    },
  )

  it('keeps the reason on the element, because a refusal is a row state', () => {
    expect(render('payloadTooLarge').attributes('data-reason')).toBe('payloadTooLarge')
  })
})
