import { MediaId, SchoolId } from '@vidya/domain'

import { isAllowedMimeType, maxBytesOf, storageKeyOf } from '../mediaLimits'

const schoolId = '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' as SchoolId
const mediaId = 'b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091' as MediaId

describe('what a school may upload', () => {
  it('takes the formats a browser plays as media', () => {
    expect(isAllowedMimeType('image', 'image/png')).toBe(true)
    expect(isAllowedMimeType('audio', 'audio/mpeg')).toBe(true)
    expect(isAllowedMimeType('video', 'video/mp4')).toBe(true)
  })

  it('refuses an SVG, which a browser executes as a document', () => {
    expect(isAllowedMimeType('image', 'image/svg+xml')).toBe(false)
  })

  it('refuses a type nobody put on the list', () => {
    expect(isAllowedMimeType('image', 'application/x-msdownload')).toBe(false)
    expect(isAllowedMimeType('video', 'text/html')).toBe(false)
  })

  it('refuses a format of the wrong kind, however playable it is', () => {
    expect(isAllowedMimeType('image', 'video/mp4')).toBe(false)
    expect(isAllowedMimeType('audio', 'image/png')).toBe(false)
  })

  it('reads the ceiling of the kind being uploaded', () => {
    const limits = { maxImageBytes: 10, maxAudioBytes: 20, maxVideoBytes: 30 }

    expect(maxBytesOf(limits, 'image')).toBe(10)
    expect(maxBytesOf(limits, 'audio')).toBe(20)
    expect(maxBytesOf(limits, 'video')).toBe(30)
  })
})

describe('where an upload is written', () => {
  it('puts the row id in the key, inside a folder of its own', () => {
    expect(storageKeyOf(`school/${schoolId}`, 'image', mediaId, 'image/png')).toBe(
      `school/${schoolId}/image/${mediaId}/original.png`,
    )
  })

  it('names the file after the type storage will serve it as', () => {
    expect(storageKeyOf('p', 'video', mediaId, 'video/mp4')).toBe(`p/video/${mediaId}/original.mp4`)
    expect(storageKeyOf('p', 'audio', mediaId, 'audio/mpeg')).toBe(
      `p/audio/${mediaId}/original.mp3`,
    )
  })

  it('falls back to a neutral extension for a type it has no name for', () => {
    expect(storageKeyOf('p', 'image', mediaId, 'image/tiff')).toBe(
      `p/image/${mediaId}/original.bin`,
    )
  })

  it('writes at the root when the profile carries no prefix', () => {
    expect(storageKeyOf('', 'image', mediaId, 'image/png')).toBe(`image/${mediaId}/original.png`)
  })

  it('never doubles the separator a prefix ends with', () => {
    expect(storageKeyOf('p/', 'image', mediaId, 'image/png')).toBe(
      `p/image/${mediaId}/original.png`,
    )
  })
})
