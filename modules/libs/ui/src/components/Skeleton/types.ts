export type SkeletonShape = 'text' | 'block' | 'circle'

export interface SkeletonProps {
  shape?: SkeletonShape
  lines?: number
  class?: string
}
