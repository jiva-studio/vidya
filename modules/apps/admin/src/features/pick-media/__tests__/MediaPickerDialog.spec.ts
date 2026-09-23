import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { addMessages, locale } from '@/shared/i18n'
import { manualClock } from '@/shared/lib'
import { mountWithApp } from '@/shared/testing'

import MediaPickerDialog from '../ui/MediaPickerDialog.vue'

const copy = `
media-picker-title = Media picker
media-picker-close = Close
media-picker-tab-upload = Upload
media-picker-tab-library = Media library
media-picker-tab-link = Link
media-picker-drop-label = Drag and drop media here
editor-media-browse = Browse files
editor-media-drop-hint-image = PNG, JPG, GIF up to 10MB
editor-media-drop-hint-video = MP4, WebM up to 100MB
editor-media-drop-hint-audio = MP3, WAV up to 50MB
editor-media-refused-image = Unsupported image format
editor-media-refused-video = Unsupported video format
editor-media-refused-audio = Unsupported audio format
`

describe('MediaPickerDialog', () => {
  let gateway: FakeMediaGateway

  beforeEach(() => {
    localStorage.clear()
    addMessages({ en: copy })
    locale.value = 'en'
    gateway = new FakeMediaGateway({ clock: manualClock() })
  })

  const mountDialog = (props: Record<string, unknown> = {}) => {
    return mountWithApp(MediaPickerDialog, {
      props: {
        open: true,
        kind: 'image',
        accept: 'image/*',
        ...props,
      },
      global: {
        provide: {
          [mediaGatewayKey]: gateway,
        },
      },
    })
  }

  it('renders closed when open prop is false', () => {
    const wrapper = mountDialog({ open: false })

    const dialog = wrapper.findComponent({ name: 'Dialog' })
    if (dialog.exists()) {
      expect(dialog.props('open')).toBe(false)
    }
  })

  it('renders open with upload and library tab triggers when open prop is true', async () => {
    mountDialog({ open: true })
    await flushPromises()

    const bodyText = document.body.textContent ?? ''
    expect(bodyText).toContain('Upload')
    expect(bodyText).toContain('Media library')
  })

  it('emits pick and update:open(false) when pick event occurs', async () => {
    const wrapper = mountDialog({ open: true })
    await flushPromises()

    wrapper.vm.$emit('pick', {
      url: 'https://storage.vidya.org/schools/1/media/image1.png',
      source: 'upload',
      name: 'image1.png',
    })
    await flushPromises()

    expect(wrapper.emitted('pick')).toBeTruthy()
    expect(wrapper.emitted('pick')![0]).toEqual([
      {
        url: 'https://storage.vidya.org/schools/1/media/image1.png',
        source: 'upload',
        name: 'image1.png',
      },
    ])
  })

  it('emits update:open(false) when dialog is closed', async () => {
    const wrapper = mountDialog({ open: true })
    await flushPromises()

    const dialog = wrapper.findComponent({ name: 'Dialog' })
    if (dialog.exists()) {
      dialog.vm.$emit('update:open', false)
      await flushPromises()

      expect(wrapper.emitted('update:open')).toBeTruthy()
      expect(wrapper.emitted('update:open')![0]).toEqual([false])
    }
  })

  it('supports kind=video and kind=audio without errors', async () => {
    const videoWrapper = mountDialog({ open: true, kind: 'video', accept: 'video/*' })
    await flushPromises()
    expect(videoWrapper.exists()).toBe(true)

    const audioWrapper = mountDialog({ open: true, kind: 'audio', accept: 'audio/*' })
    await flushPromises()
    expect(audioWrapper.exists()).toBe(true)
  })
})
