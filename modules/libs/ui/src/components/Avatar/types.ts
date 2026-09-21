export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  /** Optional because the schema lets a person have none, and the wire omits it. */
  name?: string
  src?: string
  size?: AvatarSize
  class?: string
}
