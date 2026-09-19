import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { BlockId, BlockSource, ImageBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import type { MediaKind } from '@/entities/media'
import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { systemClock } from '@/shared/lib'

import type { MediaBlock } from './MediaBlockEditor.types'
import MediaBlockEditor from './MediaBlockEditor.vue'

const image = (source: BlockSource, url: string, caption?: string): ImageBlock => ({
  id: asId<BlockId>('b1'),
  type: 'image',
  source,
  url,
  caption,
})

const over =
  (value: MediaBlock, kind: MediaKind = 'image', frozen = false) =>
  () => ({
    components: { MediaBlockEditor },
    setup() {
      const model = ref(value)
      return { model, kind, frozen, onUpdate: (next: MediaBlock) => (model.value = next) }
    },
    provide: { [mediaGatewayKey as symbol]: new FakeMediaGateway({ clock: systemClock }) },
    template: `<div class="max-w-[var(--prose-max)]">
    <MediaBlockEditor :block="model" :kind="kind" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof MediaBlockEditor> = {
  title: 'Admin/Parts/Lesson editor/Media block',
  component: MediaBlockEditor,
}

export default meta
type Story = StoryObj<typeof MediaBlockEditor>

export const Empty: Story = { render: over(image('url', '')) }

export const Default: Story = {
  name: 'Filled',
  render: over(image('url', 'https://picsum.photos/640/360', 'The temple courtyard')),
}

export const Unavailable: Story = {
  name: 'Uploaded in a session that has ended',
  render: over(image('upload', '/media/00000000-0000-4000-8000-000000000001')),
}

export const Frozen: Story = {
  name: 'Frozen',
  render: over(image('url', 'https://picsum.photos/640/360'), 'image', true),
}
