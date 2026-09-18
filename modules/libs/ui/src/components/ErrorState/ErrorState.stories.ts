import ErrorState from './ErrorState.vue'

export default { title: 'Data/ErrorState', component: ErrorState }

export const Default = {
  args: { description: 'The server did not answer. The list may be out of date.' },
}

export const Refused = {
  args: {
    title: 'The server refused',
    description: 'A course with this name already exists in this school.',
  },
}

export const WithoutRetry = {
  args: { description: 'You do not have access to this school.', retryLabel: '' },
}
