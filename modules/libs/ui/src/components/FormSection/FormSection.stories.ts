import FormField from '../FormField'
import Input from '../Input'
import FormSection from './FormSection.vue'

const render = (args: Record<string, unknown>) => ({
  components: { FormSection, FormField, Input },
  setup: () => ({ args }),
  template: `
    <FormSection v-bind="args">
      <FormField label="Course name" v-slot="field">
        <Input :id="field.id" />
      </FormField>
    </FormSection>
  `,
})

export default { title: 'Input/FormSection', component: FormSection }

export const Default = { render, args: { title: 'General' } }
export const WithDescription = {
  render,
  args: { title: 'General', description: 'What students see before they enrol.' },
}
export const Bare = { render, args: {} }
