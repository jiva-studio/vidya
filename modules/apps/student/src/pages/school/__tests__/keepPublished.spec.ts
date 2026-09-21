import { asId, type CourseId, type SchoolId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aCourse } from '@/shared/data/__tests__/fakeDevice'

import { keepPublished } from '../model'

const gita = asId<SchoolId>('school-1')

describe('the catalogue of one school', () => {
  it('leaves a draft out, although the device holds it', () => {
    const kept = keepPublished([aCourse({ status: 'draft' })], gita)

    expect(kept).toEqual([])
  })

  it('shows what the school has published', () => {
    const kept = keepPublished([aCourse({ status: 'published' })], gita)

    expect(kept.map((course) => course.name)).toEqual(['Bhagavad Gita'])
  })

  it('shows no course of another school under this one', () => {
    const theirs = aCourse({ id: asId<CourseId>('course-2'), schoolId: asId<SchoolId>('school-2') })

    expect(keepPublished([theirs], gita)).toEqual([])
  })
})
