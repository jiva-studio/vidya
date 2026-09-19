import EmptyState from './EmptyState.vue'

export default { title: 'Design system/Feedback/EmptyState', component: EmptyState }

export const WithAction = {
  args: {
    title: 'No courses yet',
    description: 'A course holds the lessons students work through. Create the first one.',
    actionLabel: 'Create course',
  },
}

export const WithoutAction = {
  args: {
    title: 'No homework waiting',
    description: 'Work appears here as students hand it in. Nothing to review right now.',
  },
}

export const AfterFilter = {
  args: {
    title: 'No enrolment matches these filters',
    description: 'Clear the status filter to see the whole queue again.',
    actionLabel: 'Clear filters',
  },
}
