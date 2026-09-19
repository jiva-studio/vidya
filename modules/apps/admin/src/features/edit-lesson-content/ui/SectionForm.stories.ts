import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { LessonSection, SectionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { ref } from 'vue'

import SectionForm from './SectionForm.vue'

const section = (title: string, assessment: LessonSection['assessment']): LessonSection => ({
  id: asId<SectionId>('s1'),
  title,
  blocks: [],
  assessment,
})

const over =
  (value: LessonSection, frozen = false) =>
  () => ({
    components: { SectionForm },
    setup() {
      const model = ref(value)
      const onRename = (_id: SectionId, title: string) => (model.value = { ...model.value, title })
      const onAssessment = (_id: SectionId, assessment: LessonSection['assessment']) =>
        (model.value = { ...model.value, assessment })
      return { model, frozen, onRename, onAssessment }
    },
    template: `<div class="max-w-[var(--form-max)]">
    <SectionForm
      :section="model"
      :frozen="frozen"
      @rename="onRename"
      @assessment="onAssessment"
    />
  </div>`,
  })

const meta: Meta<typeof SectionForm> = {
  title: 'Admin/Parts/Lesson editor/Section',
  component: SectionForm,
}

export default meta
type Story = StoryObj<typeof SectionForm>

export const Default: Story = { render: over(section('Алфавит', 'none')) }

export const Empty: Story = { render: over(section('', 'none')) }

export const WithHomework: Story = {
  name: 'Asks for homework',
  render: over(section('Сандхи', 'teacher')),
}

export const Frozen: Story = { name: 'Frozen', render: over(section('Сандхи', 'teacher'), true) }
