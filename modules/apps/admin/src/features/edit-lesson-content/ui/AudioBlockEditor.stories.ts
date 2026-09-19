import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { AudioBlock, BlockId, BlockSource } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import { FakeMediaGateway, mediaGatewayKey } from '@/entities/media'
import { systemClock } from '@/shared/lib'

import AudioBlockEditor from './AudioBlockEditor.vue'

const block = (source: BlockSource, url: string): AudioBlock => ({
  id: asId<BlockId>('b1'),
  type: 'audio',
  source,
  url,
})

const over =
  (value: AudioBlock, frozen = false) =>
  () => ({
    components: { AudioBlockEditor },
    setup() {
      const model = ref(value)
      return { model, frozen, onUpdate: (next: AudioBlock) => (model.value = next) }
    },
    provide: { [mediaGatewayKey as symbol]: new FakeMediaGateway({ clock: systemClock }) },
    template: `<div class="max-w-[var(--prose-max)]">
    <AudioBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof AudioBlockEditor> = {
  title: 'Admin/Parts/Lesson editor/Audio block',
  component: AudioBlockEditor,
}

export default meta
type Story = StoryObj<typeof AudioBlockEditor>

export const Default: Story = { render: over(block('url', 'https://example.org/lesson.mp3')) }

export const Empty: Story = { render: over(block('url', '')) }

export const Frozen: Story = {
  name: 'Frozen',
  render: over(block('url', 'https://example.org/lesson.mp3'), true),
}
