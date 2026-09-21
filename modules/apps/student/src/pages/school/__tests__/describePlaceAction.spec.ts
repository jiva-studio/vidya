import { EnrollmentStatuses, toIsoDateTime } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { describePlaceAction } from '../model'

const PUT_AWAY = toIsoDateTime(new Date('2026-02-01T00:00:00.000Z'))

const standing = (status: (typeof EnrollmentStatuses)[number], archived = false) => ({
  status,
  archivedByStudentAt: archived ? PUT_AWAY : null,
})

describe('what a request offers to do with itself', () => {
  it('offers to hand a waiting request back', () => {
    expect(describePlaceAction(standing('pending')).action).toBe('withdraw')
  })

  it('offers to leave a course the student was taken on to', () => {
    expect(describePlaceAction(standing('accepted')).action).toBe('withdraw')
  })

  it('asks before either, because neither is this application to undo', () => {
    expect(describePlaceAction(standing('pending')).confirmation).toBeDefined()
    expect(describePlaceAction(standing('accepted')).confirmation).toBeDefined()
  })

  it('names leaving a course and cancelling a request differently', () => {
    expect(describePlaceAction(standing('accepted')).label).not.toBe(
      describePlaceAction(standing('pending')).label,
    )
  })

  it.each(['declined', 'revoked', 'withdrawn'] as const)(
    'offers to put a finished request away, when it is %s',
    (status) => {
      expect(describePlaceAction(standing(status)).action).toBe('archive')
    },
  )

  it('asks nothing before putting one away, because bringing it back is one click', () => {
    expect(describePlaceAction(standing('declined')).confirmation).toBeUndefined()
  })

  it.each(EnrollmentStatuses)('offers to bring a %s request back once it is put away', (status) => {
    expect(describePlaceAction(standing(status, true)).action).toBe('unarchive')
  })

  it('leaves a place the student still holds where it is, put away or not', () => {
    expect(describePlaceAction(standing('accepted', true)).action).toBe('unarchive')
    expect(describePlaceAction(standing('accepted')).action).toBe('withdraw')
  })

  it.each(EnrollmentStatuses)('names the button of a %s request in the bundles', (status) => {
    expect(describePlaceAction(standing(status)).label).toMatch(/^place-/)
  })

  it('assigns the danger variant to withdraw actions and secondary to archive/unarchive actions', () => {
    expect(describePlaceAction(standing('pending')).variant).toBe('danger')
    expect(describePlaceAction(standing('accepted')).variant).toBe('danger')
    expect(describePlaceAction(standing('declined')).variant).toBe('secondary')
    expect(describePlaceAction(standing('revoked')).variant).toBe('secondary')
    expect(describePlaceAction(standing('withdrawn')).variant).toBe('secondary')
    expect(describePlaceAction(standing('accepted', true)).variant).toBe('secondary')
    expect(describePlaceAction(standing('pending', true)).variant).toBe('secondary')
  })
})
