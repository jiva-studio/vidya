export interface EmptyStateProps {
  // What is missing, named as a thing: "No courses yet".
  title: string
  // What to do about it. An empty state without this is a dead end.
  description: string
  actionLabel?: string
  class?: string
}

export interface EmptyStateEmits {
  action: []
}
