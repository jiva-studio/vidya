import FormField from '../FormField'
import Input from '../Input'
import FieldGroup from './FieldGroup.vue'

const render = (args: Record<string, unknown>) => ({
  components: { FieldGroup, FormField, Input },
  setup: () => ({ args }),
  template: `
    <FieldGroup v-bind="args">
      <FormField label="Course name" v-slot="field">
        <Input :id="field.id" />
      </FormField>
    </FieldGroup>
  `,
})

export default { title: 'Input/FieldGroup', component: FieldGroup }

export const Default = { render, args: { title: 'General' } }
export const WithDescription = {
  render,
  args: { title: 'General', description: 'What students see before they enrol.' },
}
export const Bare = { render, args: {} }
