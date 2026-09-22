import { faker } from '@faker-js/faker'
import * as domain from '@vidya/domain'
import { mediaPath } from '@vidya/domain'

import { mediaIdsIn } from '../mediaInContent'
import {
  ADDRESS_FIELDS,
  blockKinds,
  blockWithText,
  contentOf,
  everyTextFieldClassified,
  PROSE_FIELDS,
} from './contentAddresses'

const someMedia = () => domain.asId<domain.MediaId>(faker.string.uuid())

describe('the files a lesson document points at', () => {
  it('names the poster a video block shows as well as the video itself', () => {
    const video = someMedia()
    const poster = someMedia()

    const found = mediaIdsIn(
      contentOf([
        {
          id: domain.asId<domain.BlockId>(faker.string.uuid()),
          type: 'video',
          source: 'upload',
          url: mediaPath(video),
          posterUrl: mediaPath(poster),
        },
      ]),
    )

    expect(found.sort()).toEqual([video, poster].sort())
  })

  it('names the file in every address a block of any kind carries', () => {
    expect(everyTextFieldClassified).toEqual({
      text: true,
      image: true,
      video: true,
      audio: true,
      quiz: true,
    })

    for (const kind of blockKinds) {
      for (const field of ADDRESS_FIELDS[kind] as readonly string[]) {
        const stored = someMedia()

        expect({
          kind,
          field,
          found: mediaIdsIn(contentOf([blockWithText(kind, [field], mediaPath(stored))])),
        }).toEqual({ kind, field, found: [stored] })
      }
    }
  })

  it('leaves a path that a student reads as words out of the files it names', () => {
    for (const kind of blockKinds) {
      const prose: readonly string[] = PROSE_FIELDS[kind]
      if (prose.length === 0) continue

      expect({
        kind,
        found: mediaIdsIn(contentOf([blockWithText(kind, prose, mediaPath(someMedia()))])),
      }).toEqual({ kind, found: [] })
    }
  })

  it('names a file once however many addresses of however many blocks show it', () => {
    const shared = someMedia()

    const found = mediaIdsIn(
      contentOf([
        {
          id: domain.asId<domain.BlockId>(faker.string.uuid()),
          type: 'video',
          source: 'upload',
          url: mediaPath(shared),
          posterUrl: mediaPath(shared),
        },
        {
          id: domain.asId<domain.BlockId>(faker.string.uuid()),
          type: 'image',
          source: 'upload',
          url: mediaPath(shared),
        },
      ]),
    )

    expect(found).toEqual([shared])
  })
})
