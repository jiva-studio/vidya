export const shellClasses = ['min-h-screen flex bg-[var(--color-page)] text-[var(--color-text)]']

export const sidebarClasses = [
  'hidden md:flex shrink-0 flex-col',
  'w-[var(--sidebar-width)] h-screen sticky top-0',
  'bg-[var(--color-surface)] border-r border-[var(--color-border)]',
]

export const mainClasses = ['flex-1 min-w-0 flex flex-col']

export const headerClasses = [
  'sticky top-0 z-[var(--z-sticky)]',
  'flex items-center gap-[var(--space-3)]',
  'h-[var(--space-7)] px-[var(--space-6)]',
  'bg-[var(--color-surface)] border-b border-[var(--color-border)]',
]

export const contentClasses = [
  'flex-1 w-full max-w-[var(--content-max)]',
  'px-[var(--space-6)] py-[var(--space-6)]',
  'flex flex-col gap-[var(--space-5)]',
]
