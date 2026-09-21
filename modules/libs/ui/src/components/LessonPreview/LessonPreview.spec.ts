import type { BlockId, LessonContent, SectionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LessonPreview from './LessonPreview.vue'
import type { LessonPreviewLabels } from './types'

const labels: LessonPreviewLabels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const section = (id: string, title: string, blocks: unknown[]) => ({
  id: asId<SectionId>(id),
  title,
  assessment: 'none',
  blocks,
})

const text = (id: string, content: string) => ({
  id: asId<BlockId>(id),
  type: 'text',
  content,
})

const lesson = (sections: unknown[]): LessonContent =>
  ({ schemaVersion: 1, sections }) as unknown as LessonContent

const draw = (content: LessonContent) => mount(LessonPreview, { props: { content, labels } })

describe('LessonPreview', () => {
  it('draws the sections in the order the lesson lists them', () => {
    const page = draw(
      lesson([
        section('s1', 'The alphabet', [text('b1', 'First')]),
        section('s2', 'The vowels', [text('b2', 'Second')]),
      ]),
    )

    const titles = page.findAll('h3').map((title) => title.text())

    expect(titles).toEqual(['The alphabet', 'The vowels'])
  })

  it('draws the blocks of a section in the order the section lists them', () => {
    const page = draw(
      lesson([section('s1', 'The alphabet', [text('b1', 'First'), text('b2', 'Second')])]),
    )

    expect(page.text().indexOf('First')).toBeLessThan(page.text().indexOf('Second'))
  })

  it('names a section that has no title with the words it was given', () => {
    const page = draw(lesson([section('s1', '', [text('b1', 'Anything')])]))

    expect(page.get('h3').text()).toBe('Untitled section')
  })

  it('names a block kind it cannot draw, so a reader is not left with a gap', () => {
    const page = draw(
      lesson([section('s1', 'The alphabet', [{ id: asId<BlockId>('b1'), type: 'image' }])]),
    )

    expect(page.text()).toContain('Unknown block of kind image.')
  })

  it('draws nothing at all for a lesson without sections', () => {
    expect(draw(lesson([])).findAll('article')).toEqual([])
  })
})
