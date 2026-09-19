import Breadcrumbs from '../Breadcrumbs'
import Button from '../Button'
import PageHeader from './PageHeader.vue'

const render = (args: Record<string, unknown>) => ({
  components: { PageHeader, Button, Breadcrumbs },
  setup: () => ({ args }),
  template: `
    <PageHeader v-bind="args">
      <template #breadcrumbs>
        <Breadcrumbs :items="[{ key: 'courses', label: 'Courses' }]" />
      </template>
      <template #actions><Button>Create course</Button></template>
    </PageHeader>
  `,
})

const plain = (args: Record<string, unknown>) => ({
  components: { PageHeader },
  setup: () => ({ args }),
  template: '<PageHeader v-bind="args" />',
})

export default { title: 'Design system/Layout/PageHeader', component: PageHeader }

export const WithAction = { render, args: { title: 'Courses' } }
export const WithDescription = {
  render,
  args: { title: 'Courses', description: 'Everything this school teaches.' },
}
export const TitleOnly = { render: plain, args: { title: 'Courses' } }
export const WithoutAction = {
  render: plain,
  args: { title: 'Courses', description: 'You may read this list but not change it.' },
}
