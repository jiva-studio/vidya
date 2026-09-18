import type { CourseId } from '@vidya/domain'
import type { CourseSummary } from '@vidya/protocol'

export interface CourseCardProps {
  name: string
  description?: string
}

export interface CoursesListProps {
  items: CourseSummary[]
}

export interface CoursesListEmits {
  click: [courseId: CourseId]
}
