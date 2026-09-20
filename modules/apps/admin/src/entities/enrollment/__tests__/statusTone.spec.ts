import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { EnrollmentStatuses } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { enrollmentLabels, enrollmentTones } from '../ui/statusTone'

const TONES = ['neutral', 'accent', 'success', 'warning', 'danger', 'info']

/**
 * Read from disk rather than imported: the texts belong to a page, and a test
 * of an entity may not reach across the slice boundary to fetch them.
 */
const localeKeys = (language: 'en' | 'ru'): string[] =>
  readFileSync(
    join(__dirname, '..', '..', '..', 'pages', 'enrollments', 'i18n', `${language}.ftl`),
    'utf8',
  )
    .split('\n')
    .map((line) => /^([a-z][\w-]*) *=/.exec(line)?.[1])
    .filter((key): key is string => key !== undefined)

describe('enrollmentTones', () => {
  it('gives every state of a request a badge', () => {
    for (const status of EnrollmentStatuses) {
      expect(TONES).toContain(enrollmentTones[status])
    }
  })

  it('answers for a student who left the course', () => {
    expect(enrollmentTones.withdrawn).toBeDefined()
  })
})

describe('enrollmentLabels', () => {
  it('names a text for every state of a request', () => {
    for (const status of EnrollmentStatuses) {
      expect(enrollmentLabels[status]).toBe(`enrollment-status-${status}`)
    }
  })

  it('names a text for a student who left the course', () => {
    expect(enrollmentLabels.withdrawn).toBe('enrollment-status-withdrawn')

    for (const language of ['en', 'ru'] as const) {
      expect(localeKeys(language)).toContain('enrollment-status-withdrawn')
    }
  })

  it('has that text in both languages', () => {
    for (const language of ['en', 'ru'] as const) {
      const keys = localeKeys(language)

      for (const status of EnrollmentStatuses) {
        expect(keys).toContain(enrollmentLabels[status])
      }
    }
  })
})
