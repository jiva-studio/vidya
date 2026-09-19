import Button from './Button.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Button },
  setup: () => ({ args }),
  template: '<Button v-bind="args">Save course</Button>',
})

export default {
  title: 'Design system/Forms/Button',
  component: Button,
}

export const Primary = { render, args: { variant: 'primary' } }
export const Secondary = { render, args: { variant: 'secondary' } }
export const Ghost = { render, args: { variant: 'ghost' } }
export const Danger = { render, args: { variant: 'danger' } }
export const Busy = { render, args: { busy: true } }
export const Disabled = { render, args: { disabled: true } }
export const Small = { render, args: { size: 'sm' } }
export const Large = { render, args: { size: 'lg' } }
