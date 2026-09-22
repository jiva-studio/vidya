import type { AudioBlock, BlockId, VideoBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { type MediaResolver, mediaResolverKey } from '../../lib/mediaResolver'
import type { LessonPreviewLabels, LessonProgress } from '../LessonPreview/types'
import MediaPreview from './MediaPreview.vue'

const labels: LessonPreviewLabels = {
  untitledSection: 'Untitled section',
  embeddedMedia: 'Embedded media',
  missingMedia: 'No playable link yet.',
  emptyQuestion: 'No question yet.',
  rightAnswer: 'right answer',
  describeUnknownBlock: (type: string) => `Unknown block of kind ${type}.`,
}

const video = (over: Partial<VideoBlock> = {}): VideoBlock =>
  ({ id: asId<BlockId>('b1'), type: 'video', source: 'url', url: '', ...over }) as VideoBlock

const audio = (over: Partial<AudioBlock> = {}): AudioBlock =>
  ({ id: asId<BlockId>('b2'), type: 'audio', source: 'url', url: '', ...over }) as AudioBlock

const draw = (block: VideoBlock | AudioBlock, resolveUpload?: MediaResolver) =>
  mount(MediaPreview, {
    props: { block, labels },
    global: resolveUpload ? { provide: { [mediaResolverKey as symbol]: resolveUpload } } : {},
  })

describe('MediaPreview', () => {
  it('frames an embed rather than handing its page to a player', () => {
    const page = draw(video({ source: 'youtube', url: 'https://youtu.be/abc' }))

    expect(page.get('iframe').attributes('src')).toBe('https://www.youtube.com/embed/abc')
    expect(page.get('iframe').attributes('title')).toBe('Embedded media')
    expect(page.findAll('video')).toEqual([])
  })

  it('plays a direct video link in a player of its own', () => {
    const page = draw(video({ url: 'https://example.org/lecture.mp4' }))

    expect(page.get('video').attributes('src')).toBe('https://example.org/lecture.mp4')
  })

  it('plays a direct audio link in a player of its own', () => {
    const page = draw(audio({ url: 'https://example.org/kirtan.mp3' }))

    expect(page.get('audio').attributes('src')).toBe('https://example.org/kirtan.mp3')
    expect(page.findAll('video')).toEqual([])
  })

  it('asks the application for the address of a file it stores', () => {
    const page = draw(video({ source: 'upload', url: '/media/abc' }), (url) =>
      url === '/media/abc' ? 'blob:local/abc' : undefined,
    )

    expect(page.get('video').attributes('src')).toBe('blob:local/abc')
  })

  it('states the absence when nothing can answer for a stored file', () => {
    const page = draw(video({ source: 'upload', url: '/media/abc' }))

    expect(page.text()).toBe('No playable link yet.')
    expect(page.findAll('video')).toEqual([])
  })

  it('draws a refused link as an absence rather than pointing a player at it', () => {
    const page = draw(video({ url: 'javascript:alert(1)' }))

    expect(page.text()).toBe('No playable link yet.')
    expect(page.findAll('iframe')).toEqual([])
  })
})

const watching = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  states: {},
  editable: true,
  verdicts: {},
  labels: {
    markRead: 'Mark as read',
    answerRecorded: 'Your answer is in.',
    answerCorrect: 'Right',
    answerIncorrect: 'Wrong',
  },
  ...over,
})

const play = (block: VideoBlock | AudioBlock, progress: LessonProgress) =>
  mount(MediaPreview, { props: { block, labels, progress } })

/** jsdom implements no playback, so the player's position is stated outright. */
const positionAt = (element: Element, currentTime: number, duration = 600) => {
  Object.defineProperty(element, 'currentTime', { value: currentTime, writable: true })
  Object.defineProperty(element, 'duration', { value: duration, writable: true })
}

describe('MediaPreview as the student watches it', () => {
  it('records where playing stopped', async () => {
    const page = play(video({ url: 'https://example.org/lecture.mp4' }), watching())
    const player = page.get('video')

    positionAt(player.element, 42)
    await player.trigger('pause')

    expect(page.emitted('change')).toEqual([[{ type: 'video', watched: 42, duration: 600 }]])
  })

  it('records a finished recording under the kind it was played as', async () => {
    const page = play(audio({ url: 'https://example.org/kirtan.mp3' }), watching())
    const player = page.get('audio')

    positionAt(player.element, 300)
    await player.trigger('ended')

    expect(page.emitted('change')).toEqual([[{ type: 'audio', listened: 300, duration: 600 }]])
  })

  it('records nothing for an embed, which reports no position of its own', async () => {
    const page = play(video({ source: 'youtube', url: 'https://youtu.be/abc' }), watching())

    expect(page.findAll('video')).toEqual([])
    expect(page.emitted('change')).toBeUndefined()
  })

  it('keeps a tick of playback from becoming a write', async () => {
    const page = play(video({ url: 'https://example.org/lecture.mp4' }), watching())
    const player = page.get('video')

    positionAt(player.element, 3)
    await player.trigger('timeupdate')

    expect(page.emitted('change')).toBeUndefined()
  })

  it('records the position again once playing has moved on', async () => {
    const page = play(video({ url: 'https://example.org/lecture.mp4' }), watching())
    const player = page.get('video')

    positionAt(player.element, 400)
    await player.trigger('timeupdate')

    expect(page.emitted('change')).toEqual([[{ type: 'video', watched: 400, duration: 600 }]])
  })

  it('starts where the student left off rather than at the beginning', async () => {
    const seen = watching({
      states: { [asId<BlockId>('b1')]: { type: 'video', watched: 120, duration: 600 } },
    })
    const page = play(video({ url: 'https://example.org/lecture.mp4' }), seen)
    const player = page.get('video')

    positionAt(player.element, 0)
    await player.trigger('loadedmetadata')

    expect((player.element as HTMLVideoElement).currentTime).toBe(120)
  })

  it('records nothing in a tab that may not write', async () => {
    const page = play(
      video({ url: 'https://example.org/lecture.mp4' }),
      watching({ editable: false }),
    )
    const player = page.get('video')

    positionAt(player.element, 42)
    await player.trigger('pause')

    expect(page.emitted('change')).toBeUndefined()
  })
})
