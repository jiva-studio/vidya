export interface AccountMenuProps {
  name: string
  email?: string
}

export interface AccountMenuEmits {
  (event: 'sign-out'): void
}
