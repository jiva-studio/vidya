import type { ImageBlock, QuizBlock } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { createBlock } from '../model'
import { BlockTypes } from '../types'

describe('block blanks', () => {
  it('offers an image alongside the kinds that were always there', () => {
    expect([...BlockTypes]).toEqual(['text', 'image', 'video', 'audio', 'quiz'])
  })

  it('creates an image with an empty link and no caption', () => {
    const block = createBlock('image') as ImageBlock

    expect(block.type).toBe('image')
    expect(block.url).toBe('')
    expect(block.caption).toBeUndefined()
    expect(block.id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('starts every media blank as a link, because nothing has been uploaded yet', () => {
    for (const type of ['image', 'video', 'audio'] as const) {
      const block = createBlock(type) as ImageBlock

      expect(block.source).toBe('url')
    }
  })

  it('gives a new quiz two options and no explanation', () => {
    const block = createBlock('quiz') as QuizBlock

    expect(block.answers).toEqual(['', ''])
    expect(block.rightAnswer).toBe(0)
    expect(block.explanation).toBeUndefined()
  })

  it('mints a fresh identifier for every block', () => {
    expect(createBlock('text').id).not.toBe(createBlock('text').id)
  })
})
