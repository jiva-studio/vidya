import { MediaId } from '../identity'
import { isMediaPath, mediaPath, parseMediaPath, ReadWindowSeconds, windowExpiry } from '../media'

// An exact multiple of the one-hour window, so the cases either side of a
// boundary are unambiguous.
const WINDOW_START = 1_700_002_800_000

const ID = '6f0a1f4e-1f2b-4f3c-8d5e-7a8b9c0d1e2f' as MediaId

describe('the address lesson content stores for an uploaded file', () => {
  it('reads the id back out of a path it produced', () => {
    expect(parseMediaPath(mediaPath(ID))).toBe(ID)
  })

  it('refuses a prefix that names no file', () => {
    expect(parseMediaPath('/media/')).toBeUndefined()
  })

  it('refuses a traversal that begins with the prefix', () => {
    expect(parseMediaPath('/media/../secrets')).toBeUndefined()
    expect(parseMediaPath('/media/..%2Fsecrets')).toBeUndefined()
  })

  it('refuses an id that is not a uuid', () => {
    expect(parseMediaPath('/media/original.png')).toBeUndefined()
    expect(parseMediaPath('/media/6f0a1f4e-1f2b-4f3c-8d5e')).toBeUndefined()
    expect(parseMediaPath(`/media/${ID}/original.png`)).toBeUndefined()
  })

  it('refuses an absolute address, so a signature can never be stored as content', () => {
    expect(parseMediaPath(`https://cdn.example/media/${ID}`)).toBeUndefined()
    expect(parseMediaPath(`media://${ID}`)).toBeUndefined()
  })

  it('answers the same question as parsing, for callers that only need yes or no', () => {
    expect(isMediaPath(mediaPath(ID))).toBe(true)
    expect(isMediaPath('/media/')).toBe(false)
  })
})

describe('the expiry every reader of a file inside one window is given', () => {
  it('gives two readers inside the same window one identical address to cache', () => {
    const window = ReadWindowSeconds.image

    const early = windowExpiry(WINDOW_START + 1_000, window)
    const late = windowExpiry(WINDOW_START + 3_599_000, window)

    expect(late).toBe(early)
    expect(early).toBe(WINDOW_START + 3_600_000)
  })

  it('rounds up to the window boundary rather than to now plus the window', () => {
    const window = ReadWindowSeconds.image
    const now = WINDOW_START + 1_000

    expect(windowExpiry(now, window)).toBe(WINDOW_START + 3_600_000)
    expect(windowExpiry(now, window)).toBeLessThan(now + 3_600_000)
  })

  it('never hands out an expiry that has already passed', () => {
    for (const now of [0, 1, 3_599_999, 3_600_000, 1_758_412_800_000]) {
      expect(windowExpiry(now, 3600)).toBeGreaterThan(now)
    }
  })

  it('gives audio and video the six hours a lecture needs, and an image one', () => {
    expect(ReadWindowSeconds.image).toBe(3600)
    expect(ReadWindowSeconds.audio).toBe(21600)
    expect(ReadWindowSeconds.video).toBe(21600)
  })
})
