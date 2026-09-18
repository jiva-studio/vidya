import Card from './Card.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Card },
  setup: () => ({ args }),
  template: '<Card v-bind="args"><p>Thirty-one students, four groups.</p></Card>',
})

export default { title: 'Shell/Card', component: Card }

export const Default = { render, args: { title: 'Sanskrit grammar' } }
export const WithDescription = {
  render,
  args: { title: 'Sanskrit grammar', description: 'Guided, twelve lessons.' },
}
export const Bare = { render, args: {} }
export const Flush = { render, args: { title: 'Courses', padded: false } }
