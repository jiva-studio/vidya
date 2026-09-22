import { asId, type BlockId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aBlockState, aVersion } from '@/shared/data/__tests__/fakeDevice'

import { recordBlockState } from '../model'

const version = aVersion()
const enrollmentId = aBlockState().enrollmentId
const read = { type: 'text', read: true } as const

const record = (blockId: string, states = [aBlockState()]) =>
  recordBlockState({
    version,
    enrollmentId,
    states,
    blockId: asId<BlockId>(blockId),
    state: read,
    mintId: () => 'state-new',
  })

describe('recordBlockState', () => {
  it('writes what the student did against the version they were reading', () => {
    expect(record('block-2', [])).toEqual({
      id: 'state-new',
      schoolId: version.schoolId,
      enrollmentId,
      lessonVersionId: version.id,
      blockId: 'block-2',
      state: read,
    })
  })

  it('keeps the id the state was first written under, so one block holds one row', () => {
    expect(record('block-1').id).toBe('state-1')
  })

  it('names a state of another block apart from this one', () => {
    expect(record('block-2').id).toBe('state-new')
  })
})
