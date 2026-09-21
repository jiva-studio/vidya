import type { AudioBlock, BlockId, VideoBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { type MediaResolver, mediaResolverKey } from '../../lib/mediaResolver'
import type { LessonPreviewLabels } from '../LessonPreview/types'
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
