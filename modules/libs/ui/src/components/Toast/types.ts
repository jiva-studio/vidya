export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastItem {
  id: string
  title: string
  description?: string
  tone?: ToastTone
  // A reversible action is done at once and offered back, not confirmed first.
  actionLabel?: string
  duration?: number
}

export interface ToastProps {
  toast: ToastItem
  class?: string
}

export interface ToastEmits {
  dismiss: [id: string]
  action: [id: string]
}

export interface ToasterProps {
  toasts: ToastItem[]
  label?: string
  class?: string
}

export interface ToasterEmits {
  dismiss: [id: string]
  action: [id: string]
}
