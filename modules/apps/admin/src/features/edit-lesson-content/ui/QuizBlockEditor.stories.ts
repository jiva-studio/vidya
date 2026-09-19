import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { BlockId, QuizBlock } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import QuizBlockEditor from './QuizBlockEditor.vue'

const block = (
  question: string,
  answers: string[],
  rightAnswer = 0,
  explanation?: string,
): QuizBlock => ({
  id: asId<BlockId>('b1'),
  type: 'quiz',
  question,
  answers,
  rightAnswer,
  explanation,
})

const over =
  (value: QuizBlock, frozen = false) =>
  () => ({
    components: { QuizBlockEditor },
    setup() {
      const model = ref(value)
      return { model, frozen, onUpdate: (next: QuizBlock) => (model.value = next) }
    },
    template: `<div class="max-w-[var(--form-max)]">
    <QuizBlockEditor :block="model" :frozen="frozen" @update="onUpdate" />
  </div>`,
  })

const meta: Meta<typeof QuizBlockEditor> = {
  title: 'Admin/Parts/Lesson editor/Quiz block',
  component: QuizBlockEditor,
}

export default meta
type Story = StoryObj<typeof QuizBlockEditor>

export const Default: Story = {
  render: over(block('Что меняется на стыке слов?', ['Гласная', 'Согласная', 'Ударение'], 1)),
}

export const Empty: Story = { render: over(block('', ['', ''])) }

export const WithExplanation: Story = {
  name: 'With an explanation',
  render: over(
    block(
      'Что меняется на стыке слов?',
      ['Гласная', 'Согласная', 'Ударение'],
      1,
      'Сандхи касается согласной на границе слов.',
    ),
  ),
}

export const Frozen: Story = {
  name: 'Read-only',
  render: over(block('Что меняется на стыке слов?', ['Гласная', 'Согласная'], 1), true),
}
