import Button from '../Button'
import Popover from './Popover.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Popover, Button },
  setup: () => ({ args }),
  template: `
    <Popover v-bind="args">
      <template #trigger><Button variant="secondary">Insert</Button></template>
      <p>Pick what goes into the lesson here.</p>
    </Popover>
  `,
})

export default { title: 'Design system/Overlays/Popover', component: Popover }

export const Closed = { render, args: { label: 'Insert a block' } }
export const Open = { render, args: { label: 'Insert a block', open: true } }
export const AboveTheTrigger = {
  render,
  args: { label: 'Insert a block', open: true, side: 'top', align: 'end' },
}
