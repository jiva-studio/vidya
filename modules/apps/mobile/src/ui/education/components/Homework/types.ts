import type { HomeworkStatus } from '@vidya/domain'

export interface HomeworkAnswerProps {
  status: HomeworkStatus

  /** What was submitted before, so a returned answer opens on its own text. */
  answer?: string
}

export interface HomeworkAnswerEmits {
  submit: [text: string]
}
