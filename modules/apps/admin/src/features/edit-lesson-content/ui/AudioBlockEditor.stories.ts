import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { AudioBlock, BlockId, BlockSource } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

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
    template: `<div class="max-w-[var(--form-max)]">
    <AudioBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof AudioBlockEditor> = {
  title: 'Edu/LessonEditor/AudioBlockEditor',
  component: AudioBlockEditor,
}

export default meta
type Story = StoryObj<typeof AudioBlockEditor>

export const Linked: Story = {
  name: 'Direct link',
  render: over(block('url', 'https://example.org/lesson.mp3')),
}

export const Empty: Story = { name: 'Empty', render: over(block('url', '')) }

export const Refused: Story = {
  name: 'Link that is not an address',
  render: over(block('url', 'javascript:alert(1)')),
}

export const Frozen: Story = {
  name: 'Frozen',
  render: over(block('url', 'https://example.org/lesson.mp3'), true),
}
