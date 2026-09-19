import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The one place class lists are joined. Components pass arrays from their
// styles.ts plus whatever the caller handed down through `class`.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
