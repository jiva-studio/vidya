import type { ImageBlock } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { addMessages, locale } from '@/shared/i18n'
import { manualClock } from '@/shared/lib'
import { mountWithApp } from '@/shared/testing'

import MediaBlockEditor from '../ui/MediaBlockEditor.vue'
import MediaBlockEditorEmpty from '../ui/MediaBlockEditorEmpty.vue'
import MediaBlockEditorFilled from '../ui/MediaBlockEditorFilled.vue'

const copy = `
editor-media-browse = Browse files
editor-media-drop-hint-image = PNG, JPG, GIF up to 10MB
editor-media-drop-hint-video = MP4, WebM up to 100MB
editor-media-drop-hint-audio = MP3, WAV up to 50MB
editor-media-refused-image = Unsupported image format
editor-media-refused-video = Unsupported video format
editor-media-refused-audio = Unsupported audio format
editor-media-uploaded = Attached { $name }
media-picker-title = Media picker
media-picker-close = Close
media-picker-tab-upload = Upload
media-picker-tab-library = Media library
media-picker-tab-link = Link
`

describe('MediaBlockEditor', () => {
  let gateway: FakeMediaGateway
  let clock: ReturnType<typeof manualClock>

  beforeEach(() => {
    localStorage.clear()
    addMessages({ en: copy })
    locale.value = 'en'
    clock = manualClock()
    gateway = new FakeMediaGateway({ clock })
  })

  const createEmptyBlock = (): ImageBlock => ({
    id: 'block-1',
    type: 'image',
    url: '',
    source: 'url',
    caption: '',
  })

  const createFilledBlock = (): ImageBlock => ({
    id: 'block-2',
    type: 'image',
    url: 'https://cdn.example.com/illustration.png',
    source: 'url',
    caption: 'Ancient temple layout',
  })

  const mountEditor = (block: ImageBlock, props: Record<string, unknown> = {}) => {
    return mountWithApp(MediaBlockEditor, {
      props: {
        block,
        kind: 'image',
        frozen: false,
        ...props,
      },
      global: {
        provide: {
          [mediaGatewayKey]: gateway,
        },
      },
    })
  }

  it('renders empty state when block url is empty', () => {
    const wrapper = mountEditor(createEmptyBlock())

    expect(wrapper.findComponent(MediaBlockEditorEmpty).exists()).toBe(true)
    expect(wrapper.findComponent(MediaBlockEditorFilled).exists()).toBe(false)
  })

  it('opens MediaPickerDialog when library button is clicked in empty state', async () => {
    const wrapper = mountEditor(createEmptyBlock())

    const empty = wrapper.findComponent(MediaBlockEditorEmpty)
    empty.vm.$emit('library')
    await flushPromises()

    const picker = wrapper.findComponent({ name: 'MediaPickerDialog' })
    expect(picker.exists()).toBe(true)
    expect(picker.props('open')).toBe(true)
  })

  it('emits update with picked media when media is selected in MediaPickerDialog', async () => {
    const wrapper = mountEditor(createEmptyBlock())

    const picker = wrapper.findComponent({ name: 'MediaPickerDialog' })
    picker.vm.$emit('pick', {
      url: 'https://cdn.example.com/picked-asset.jpg',
      source: 'upload',
      name: 'picked-asset.jpg',
    })
    await flushPromises()

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([
      {
        id: 'block-1',
        type: 'image',
        url: 'https://cdn.example.com/picked-asset.jpg',
        source: 'upload',
        caption: '',
      },
    ])
  })

  it('renders filled state when block url is present', () => {
    const wrapper = mountEditor(createFilledBlock())

    expect(wrapper.findComponent(MediaBlockEditorFilled).exists()).toBe(true)
    expect(wrapper.findComponent(MediaBlockEditorEmpty).exists()).toBe(false)
  })

  it('emits update when caption is changed in filled state', async () => {
    const block = createFilledBlock()
    const wrapper = mountEditor(block)

    const filled = wrapper.findComponent(MediaBlockEditorFilled)
    filled.vm.$emit('caption', 'Updated description of temple')
    await flushPromises()

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([
      {
        ...block,
        caption: 'Updated description of temple',
      },
    ])
  })

  it('emits update with cleared url when replace is clicked', async () => {
    const block = createFilledBlock()
    const wrapper = mountEditor(block)

    const filled = wrapper.findComponent(MediaBlockEditorFilled)
    filled.vm.$emit('replace')
    await flushPromises()

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([
      {
        ...block,
        url: '',
        source: 'url',
      },
    ])
  })
})
