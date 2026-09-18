import type { HomeworkStatus } from '@vidya/domain'

export interface HomeworkAnswerProps {
  status: HomeworkStatus
}

export interface HomeworkAnswerEmits {
  submit: [text: string]
}
