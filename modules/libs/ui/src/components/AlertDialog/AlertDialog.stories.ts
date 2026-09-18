import Button from '../Button'
import AlertDialog from './AlertDialog.vue'

const render = (args: Record<string, unknown>) => ({
  components: { AlertDialog, Button },
  setup: () => ({ args }),
  template: `
    <AlertDialog v-bind="args">
      <template #trigger><Button variant="danger">Delete section</Button></template>
    </AlertDialog>
  `,
})

export default { title: 'Overlay/AlertDialog', component: AlertDialog }

export const Closed = {
  render,
  args: { title: 'Delete this section?', description: 'Answers to it stop opening.' },
}

export const Destructive = {
  render,
  args: {
    open: true,
    destructive: true,
    title: 'Delete this section?',
    description: 'Twelve students answered inside it. Their answers stop opening.',
    confirmLabel: 'Delete section',
  },
}

export const Busy = {
  render,
  args: {
    open: true,
    busy: true,
    destructive: true,
    title: 'Delete this section?',
    description: 'Twelve students answered inside it. Their answers stop opening.',
    confirmLabel: 'Delete section',
  },
}

export const Neutral = {
  render,
  args: {
    open: true,
    title: 'Publish this version?',
    description: 'Students see this content from now on. The draft closes.',
    confirmLabel: 'Publish',
  },
}
