import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { BlockId, TextBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import TextBlockEditor from './TextBlockEditor.vue'

const block = (content: string): TextBlock => ({
  id: asId<BlockId>('b1'),
  type: 'text',
  content,
})

const written = `# Devanagari

Читаем **слева направо**. Буквы висят на верхней линии.

- स — «sa»
- र — «ra»`

// The editor writes into the block it is given, so a story that dropped the
// update would show a field nothing typed into stays in.
const over =
  (value: TextBlock, frozen = false) =>
  () => ({
    components: { TextBlockEditor },
    setup() {
      const model = ref(value)
      return { model, frozen, onUpdate: (next: TextBlock) => (model.value = next) }
    },
    template: `<div class="max-w-[var(--form-max)]">
    <TextBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof TextBlockEditor> = {
  title: 'Edu/LessonEditor/TextBlockEditor',
  component: TextBlockEditor,
}

export default meta
type Story = StoryObj<typeof TextBlockEditor>

export const Written: Story = { name: 'Written', render: over(block(written)) }

export const Empty: Story = { name: 'Empty', render: over(block('')) }

export const Frozen: Story = { name: 'Frozen', render: over(block(written), true) }
