export interface FailureStateProps {
  title: string
  // The reason the server gave. A generic message hides the one fact that helps.
  description?: string
  retryLabel: string
  class?: string
}

export interface FailureStateEmits {
  retry: []
}
