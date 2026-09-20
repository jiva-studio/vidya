import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { MediaGateway } from '@/entities/media'
import { FakeMediaGateway, MediaError, mediaGatewayKey } from '@/entities/media'
import { systemClock } from '@/shared/lib'

import MediaPickerDialog from './MediaPickerDialog.vue'

const working = (): MediaGateway => new FakeMediaGateway({ clock: systemClock })

/** A library nobody can read, so the failure state is drawn rather than described. */
const broken = (): MediaGateway => ({
  upload: () => Promise.reject(new MediaError('media-upload-failed')),
  list: () => Promise.reject(new MediaError('media-unavailable')),
  resolve: () => undefined,
})

const over =
  (gateway: MediaGateway, kind: 'image' | 'video' | 'audio' = 'image') =>
  () => ({
    components: { MediaPickerDialog },
    setup() {
      // A dialog story that did not open its dialog would draw an empty page.
      const open = ref(true)
      const link = ref('')
      return { open, link, kind, onOpen: (next: boolean) => (open.value = next) }
    },
    provide: { [mediaGatewayKey as symbol]: gateway },
    template: `<MediaPickerDialog
      :open="open"
      :kind="kind"
      :accept="kind + '/*'"
      :link="link"
      @update:open="onOpen"
      @update:link="(value) => (link = value)"
    />`,
  })

const meta: Meta<typeof MediaPickerDialog> = {
  title: 'Admin/Parts/Lesson editor/Media picker',
  component: MediaPickerDialog,
}

export default meta
type Story = StoryObj<typeof MediaPickerDialog>

export const Default: Story = { name: 'Upload', render: over(working()) }

export const Library: Story = { name: 'Library', render: over(working()) }

export const Empty: Story = { name: 'Library with nothing in it', render: over(working(), 'video') }

export const Failed: Story = { name: 'Library that cannot be read', render: over(broken()) }
