import AppShell from './AppShell.vue'

const render = (args: Record<string, unknown>) => ({
  components: { AppShell },
  setup: () => ({ args }),
  template: `
    <AppShell v-bind="args">
      <template #sidebar><div>Sidebar</div></template>
      <template #header><div>Courses</div></template>
      <p>Screen content sits here.</p>
    </AppShell>
  `,
})

const bare = (args: Record<string, unknown>) => ({
  components: { AppShell },
  setup: () => ({ args }),
  template: '<AppShell v-bind="args"><p>Login screen, no shell around it.</p></AppShell>',
})

export default { title: 'Shell/AppShell', component: AppShell }

export const WithSidebar = { render, args: {} }
export const WithoutSidebar = { render: bare, args: {} }
