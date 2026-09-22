import { describe, expect, it } from 'vitest'

import { aBlockState, aLesson, aVersion } from '@/shared/data/__tests__/fakeDevice'

import { toLessonRow } from '../model'

describe('a lesson and what the student has done on it', () => {
  it('counts the blocks of the version this machine holds', () => {
    const row = toLessonRow(aLesson(), aVersion(), [])

    expect(row.blocks).toBe(2)
    expect(row.done).toBe(0)
    expect(row.held).toBe(true)
  })

  it('counts a block the student has already worked through', () => {
    const row = toLessonRow(aLesson(), aVersion(), [aBlockState()])

    expect(row.done).toBe(1)
  })

  it('never claims more done than the lesson has to do', () => {
    const states = [aBlockState(), aBlockState({ id: 'state-2' }), aBlockState({ id: 'state-3' })]

    expect(toLessonRow(aLesson(), aVersion(), states).done).toBe(2)
  })

  it('says the lesson is not here rather than counting nothing out of nothing', () => {
    const row = toLessonRow(aLesson(), null, [])

    expect(row.held).toBe(false)
    expect(row.blocks).toBe(0)
  })

  it('carries the number the lesson is ordered by', () => {
    expect(toLessonRow(aLesson({ lessonNumber: 4 }), null, []).number).toBe(4)
  })
})
