import Toaster from './Toaster.vue'

const render = (args: Record<string, unknown>) => ({
  components: { Toaster },
  setup: () => ({ args }),
  template: '<Toaster v-bind="args" />',
})

export default { title: 'Overlay/Toast', component: Toaster }

export const Saved = {
  render,
  args: { toasts: [{ id: '1', title: 'Course saved', tone: 'success' }] },
}

export const Undoable = {
  render,
  args: {
    toasts: [
      {
        id: '1',
        title: 'Enrolment rejected',
        description: 'The student was told the application did not pass.',
        actionLabel: 'Undo',
      },
    ],
  },
}

export const Failed = {
  render,
  args: {
    toasts: [
      {
        id: '1',
        title: 'The server refused the change',
        description: 'A course with this name already exists in this school.',
        tone: 'danger',
      },
    ],
  },
}

export const Empty = { render, args: { toasts: [] } }
