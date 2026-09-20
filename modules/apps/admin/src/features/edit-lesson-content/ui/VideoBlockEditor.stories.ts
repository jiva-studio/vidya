import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { BlockId, BlockSource, VideoBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { systemClock } from '@/shared/lib'

import VideoBlockEditor from './VideoBlockEditor.vue'

const block = (source: BlockSource, url: string): VideoBlock => ({
  id: asId<BlockId>('b1'),
  type: 'video',
  source,
  url,
})

const over =
  (value: VideoBlock, frozen = false) =>
  () => ({
    components: { VideoBlockEditor },
    setup() {
      const model = ref(value)
      return { model, frozen, onUpdate: (next: VideoBlock) => (model.value = next) }
    },
    provide: { [mediaGatewayKey as symbol]: new FakeMediaGateway({ clock: systemClock }) },
    template: `<div class="max-w-[var(--prose-max)]">
    <VideoBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof VideoBlockEditor> = {
  title: 'Admin/Parts/Lesson editor/Video block',
  component: VideoBlockEditor,
}

export default meta
type Story = StoryObj<typeof VideoBlockEditor>

export const Default: Story = {
  render: over(block('youtube', 'https://www.youtube.com/watch?v=abc')),
}

export const Empty: Story = { render: over(block('url', '')) }

export const Frozen: Story = {
  name: 'Frozen',
  render: over(block('youtube', 'https://www.youtube.com/watch?v=abc'), true),
}
