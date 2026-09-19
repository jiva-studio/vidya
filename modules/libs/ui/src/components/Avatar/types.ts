export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  name: string
  src?: string
  size?: AvatarSize
  class?: string
}
