import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { BlockId, BlockSource, VideoBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

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
    template: `<div class="max-w-[var(--form-max)]">
    <VideoBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof VideoBlockEditor> = {
  title: 'Edu/LessonEditor/VideoBlockEditor',
  component: VideoBlockEditor,
}

export default meta
type Story = StoryObj<typeof VideoBlockEditor>

export const Embedded: Story = {
  name: 'YouTube embed',
  render: over(block('youtube', 'https://www.youtube.com/watch?v=abc')),
}

export const Empty: Story = { name: 'Empty', render: over(block('url', '')) }

export const Refused: Story = {
  name: 'Link from the wrong host',
  render: over(block('youtube', 'https://example.org/video.mp4')),
}

export const Frozen: Story = {
  name: 'Frozen',
  render: over(block('youtube', 'https://www.youtube.com/watch?v=abc'), true),
}
