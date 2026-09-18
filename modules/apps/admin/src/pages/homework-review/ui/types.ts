import type { HomeworkId } from '@vidya/domain'

/** The route hands the work over as a prop, so the screen mounts without a router. */
export interface HomeworkReviewPageProps {
  id: HomeworkId
}
