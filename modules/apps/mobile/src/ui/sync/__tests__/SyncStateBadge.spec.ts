// @vitest-environment jsdom
import { IonIcon } from '@ionic/vue'
import { submissionStateOf, SubmissionStates } from '@vidya/client'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SyncStateBadge from '../components/Outbox/SyncStateBadge.vue'
import { fluentFor } from './fluentFor'

const render = (state: (typeof SubmissionStates)[number], locale: 'en' | 'ru' = 'en') =>
  mount(SyncStateBadge, { props: { state }, global: { plugins: [fluentFor(locale)] } })

/**
 * The four states of a sent answer are told apart on screen.
 *
 * The component is told which state to show and nothing else: where the state
 * came from — the journal, a run in progress, the server's answer — is the sync
 * engine's business.
 */
describe('submission state of an answer', () => {
  it.each(SubmissionStates)('names the %s state', (state) => {
    expect(render(state).text().length).toBeGreaterThan(0)
  })

  it.each(['en', 'ru'] as const)('gives the four states four different labels in %s', (locale) => {
    const labels = SubmissionStates.map((state) => render(state, locale).text())

    expect(new Set(labels).size).toBe(SubmissionStates.length)
  })

  it('gives each state its own icon', () => {
    const icons = SubmissionStates.map((state) => render(state).getComponent(IonIcon).props('icon'))

    expect(new Set(icons).size).toBe(SubmissionStates.length)
  })

  it('marks the state on the element so a screen can style it', () => {
    expect(render('rejected').attributes('data-state')).toBe('rejected')
  })

  it.each([
    ['pending', false, 'notSent'],
    ['pending', true, 'sending'],
    ['pushed', false, 'accepted'],
    ['rejected', false, 'rejected'],
  ] as const)('reads %s (in flight: %s) as %s', (status, inFlight, expected) => {
    expect(submissionStateOf(status, inFlight)).toBe(expected)
  })
})
