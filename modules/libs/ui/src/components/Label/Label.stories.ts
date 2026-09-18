import Label from './Label.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Label },
  setup: () => ({ args }),
  template: '<Label v-bind="args">Course name</Label>',
})

export default { title: 'Input/Label', component: Label }

export const Default = { render, args: {} }
export const Required = { render, args: { required: true } }
