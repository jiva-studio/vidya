import Tabs from './Tabs.vue'
import TabsPanel from './TabsPanel.vue'

const items = [
  { value: 'content', label: 'Content' },
  { value: 'preview', label: 'Preview' },
  { value: 'versions', label: 'Versions', disabled: true },
]

const render = (args: Record<string, unknown>) => ({
  components: { Tabs, TabsPanel },
  setup: () => ({ args }),
  template: `
    <Tabs v-bind="args">
      <TabsPanel value="content">The blocks of this lesson.</TabsPanel>
      <TabsPanel value="preview">What the student will see.</TabsPanel>
    </Tabs>
  `,
})

export default { title: 'Shell/Tabs', component: Tabs }

export const Default = { render, args: { items, modelValue: 'content' } }
export const SecondSelected = { render, args: { items, modelValue: 'preview' } }
export const Segmented = { render, args: { items, modelValue: 'content', variant: 'segmented' } }
