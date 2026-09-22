import { faker } from '@faker-js/faker'
import { mediaIdsIn } from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { LessonBlock, LessonContent, mediaPath } from '@vidya/domain'

const blockId = () => domain.asId<domain.BlockId>(faker.string.uuid())
const sectionId = () => domain.asId<domain.SectionId>(faker.string.uuid())
const mediaId = () => domain.asId<domain.MediaId>(faker.string.uuid())

const imageAt = (url: string): LessonBlock => ({
  id: blockId(),
  type: 'image',
  source: 'upload',
  url,
})

const contentOf = (...sections: LessonBlock[][]): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: sections.map((blocks) => ({
    id: sectionId(),
    title: 'Section',
    assessment: 'none' as const,
    blocks,
  })),
})

describe('the files a lesson document names', () => {
  it('reads the blocks of every section, not only the first', () => {
    const first = mediaId()
    const second = mediaId()

    const found = mediaIdsIn(contentOf([imageAt(mediaPath(first))], [imageAt(mediaPath(second))]))

    expect(found.sort()).toEqual([first, second].sort())
  })

  it('names a file shown by two blocks once', () => {
    const shown = mediaId()

    expect(mediaIdsIn(contentOf([imageAt(mediaPath(shown)), imageAt(mediaPath(shown))]))).toEqual([
      shown,
    ])
  })

  it('leaves out an address that names no stored file', () => {
    const stored = mediaId()

    const found = mediaIdsIn(
      contentOf([
        imageAt('https://cdn.example/poster.png'),
        imageAt('/media/../secrets'),
        imageAt('/media/'),
        imageAt(mediaPath(stored)),
      ]),
    )

    expect(found).toEqual([stored])
  })

  it('passes over a block that carries no address at all', () => {
    const content = contentOf([{ id: blockId(), type: 'text', content: 'Read this' }])

    expect(mediaIdsIn(content)).toEqual([])
  })

  it('finds nothing in a document with no sections', () => {
    expect(mediaIdsIn(domain.emptyLessonContent())).toEqual([])
  })
})
