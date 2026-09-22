import { asId, type BlockId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { aBlockState } from '@/shared/data/__tests__/fakeDevice'

import { toVerdicts } from '../model'

const answered = (blockId: string, verdict: { correct: boolean; explanation?: string } | null) =>
  aBlockState({ id: `state-${blockId}`, blockId: asId<BlockId>(blockId), verdict })

describe('toVerdicts', () => {
  it('keys what the school said by the block it was said on', () => {
    const rows = [answered('block-1', { correct: true }), answered('block-2', { correct: false })]

    expect(toVerdicts(rows)).toEqual({
      'block-1': { correct: true },
      'block-2': { correct: false },
    })
  })

  it('leaves out a block nobody has marked, which is not the same as marked wrong', () => {
    const rows = [answered('block-1', null), answered('block-2', { correct: false })]

    expect(toVerdicts(rows)).toEqual({ 'block-2': { correct: false } })
  })

  it('carries the explanation, which travels with the verdict and nowhere else', () => {
    const rows = [answered('block-1', { correct: false, explanation: 'It opens with a vowel.' })]

    expect(toVerdicts(rows)['block-1' as BlockId]?.explanation).toBe('It opens with a vowel.')
  })

  it('answers with nothing when nothing has been answered', () => {
    expect(toVerdicts([])).toEqual({})
  })
})
