import Button from '../Button'
import Tooltip from './Tooltip.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Tooltip, Button },
  setup: () => ({ args }),
  template: `
    <Tooltip v-bind="args"><Button variant="ghost" size="sm">?</Button></Tooltip>
  `,
})

export default { title: 'Overlay/Tooltip', component: Tooltip }

export const Default = { render, args: { text: 'The student answered an older version.' } }
export const OnTheRight = { render, args: { text: 'Draft, never published.', side: 'right' } }
