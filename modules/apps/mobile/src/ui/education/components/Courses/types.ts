import type { CourseId, SchoolId } from '@vidya/domain'

export interface CourseCardProps {
  name: string
  description?: string | null

  /** Absent until the school's own row has arrived; the card draws without it. */
  schoolName?: string

  /** An external link, so it fails offline and is replaced by the initial. */
  schoolLogoUrl?: string | null
}

/** A course as the catalogue draws it: the course, plus the school it names. */
export interface CourseCardViewModel {
  id: CourseId
  schoolId: SchoolId
  name: string
  description: string | null
  schoolName?: string
  schoolLogoUrl: string | null
}

export interface CoursesListProps {
  items: readonly CourseCardViewModel[]
}

export interface CoursesListEmits {
  click: [courseId: CourseId]
}
