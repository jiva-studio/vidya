import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { BlockId, BlockSource, ImageBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { systemClock } from '@/shared/lib'

import ImageBlockEditor from './ImageBlockEditor.vue'

const block = (source: BlockSource, url: string): ImageBlock => ({
  id: asId<BlockId>('b1'),
  type: 'image',
  source,
  url,
})

const over =
  (value: ImageBlock, frozen = false) =>
  () => ({
    components: { ImageBlockEditor },
    setup() {
      const model = ref(value)
      return { model, frozen, onUpdate: (next: ImageBlock) => (model.value = next) }
    },
    provide: { [mediaGatewayKey as symbol]: new FakeMediaGateway({ clock: systemClock }) },
    template: `<div class="max-w-[var(--prose-max)]">
    <ImageBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof ImageBlockEditor> = {
  title: 'Admin/Parts/Lesson editor/Image block',
  component: ImageBlockEditor,
}

export default meta
type Story = StoryObj<typeof ImageBlockEditor>

export const Default: Story = { render: over(block('url', 'https://picsum.photos/640/360')) }

export const Empty: Story = { render: over(block('url', '')) }

export const Frozen: Story = {
  name: 'Frozen',
  render: over(block('url', 'https://picsum.photos/640/360'), true),
}
