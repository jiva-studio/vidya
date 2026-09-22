import { describe, expect, it } from 'vitest'

import { aCourse } from '@/shared/data/__tests__/fakeDevice'

import { keepOffered } from '../model'

describe('the courses a school actually offers', () => {
  it('keeps a published course', () => {
    expect(keepOffered([aCourse()])).toHaveLength(1)
  })

  it('leaves out a course the school has not published', () => {
    expect(keepOffered([aCourse({ status: 'draft' })])).toEqual([])
  })
})
