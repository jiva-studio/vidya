import * as domain from '@vidya/domain'

import { addressesOf } from '../mediaReadAccess.service'

const ID = '00000000-0000-4000-8000-0000000000b1' as domain.BlockId

const MEDIA = '3a7f2c11-0000-4000-8000-000000000001' as domain.MediaId
const POSTER = '3a7f2c11-0000-4000-8000-000000000002' as domain.MediaId

/**
 * One block of every type there is.
 *
 * Keyed by the discriminator so that a type added to the union cannot be added
 * without a fixture here: a student's access to a block is computed from the
 * addresses it carries, and a block nobody accounted for reaches the student as
 * an empty frame rather than as a compilation failure.
 */
const blocks: Record<domain.LessonBlock['type'], domain.LessonBlock> = {
  text: { id: ID, type: 'text', content: 'Prose carries no file' },
  image: { id: ID, type: 'image', source: 'upload', url: domain.mediaPath(MEDIA) },
  video: {
    id: ID,
    type: 'video',
    source: 'upload',
    url: domain.mediaPath(MEDIA),
    posterUrl: domain.mediaPath(POSTER),
  },
  audio: { id: ID, type: 'audio', source: 'upload', url: domain.mediaPath(MEDIA) },
  quiz: { id: ID, type: 'quiz', question: 'Which?', answers: ['a', 'b'], rightAnswer: 0 },
}

/** A field that names a file, however a block spells it. */
type AddressField = 'url' | `${string}Url`

type AddressFieldsOf<TBlock> = TBlock extends unknown ? Extract<keyof TBlock, AddressField> : never

/** The fields a block's addresses are read from, as the service accounts for them. */
type Accounted = 'url' | 'posterUrl'

type Unaccounted = Exclude<AddressFieldsOf<domain.LessonBlock>, Accounted>

describe('the addresses one lesson block carries', () => {
  it('finds the file an image names', () => {
    expect(addressesOf(blocks.image)).toEqual([domain.mediaPath(MEDIA)])
  })

  it('finds a video poster as well as the video itself', () => {
    expect(addressesOf(blocks.video)).toEqual([domain.mediaPath(MEDIA), domain.mediaPath(POSTER)])
  })

  it('finds nothing in a block that shows no file', () => {
    expect(addressesOf(blocks.text)).toEqual([])
    expect(addressesOf(blocks.quiz)).toEqual([])
  })

  it('leaves no address-bearing field of any block type unaccounted for', () => {
    const complete: [Unaccounted] extends [never] ? true : never = true

    expect(complete).toBe(true)
  })
})
