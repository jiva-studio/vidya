import Input from '../Input'
import FormField from './FormField.vue'

const render = (args: Record<string, unknown>) => ({
  components: { FormField, Input },
  setup: () => ({ args }),
  template: `
    <FormField v-bind="args" v-slot="field">
      <Input :id="field.id" :described-by="field.describedBy" :invalid="field.invalid" />
    </FormField>
  `,
})

export default { title: 'Input/FormField', component: FormField }

export const Default = { render, args: { label: 'Course name' } }
export const WithHint = { render, args: { label: 'Course name', hint: 'Shown to students.' } }
export const Required = { render, args: { label: 'Course name', required: true } }
export const WithError = {
  render,
  args: { label: 'Course name', error: 'A course needs a name before it can be saved.' },
}
