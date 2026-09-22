// Rendered markdown needs the shape the author typed: a heading has to look
// like a heading, or the block reads as one flat paragraph and the markdown was
// pointless. Written as descendant rules because the html arrives as a string.
export const markdownClasses = [
  'w-full text-[length:var(--text-base)] text-[var(--color-text)]',
  'flex flex-col gap-[var(--space-3)]',
  '[&_h1]:text-[length:var(--text-lg)] [&_h1]:font-[var(--weight-semibold)]',
  '[&_h2]:text-[length:var(--text-md)] [&_h2]:font-[var(--weight-semibold)]',
  '[&_h3]:text-[length:var(--text-base)] [&_h3]:font-[var(--weight-semibold)]',
  '[&_strong]:font-[var(--weight-semibold)] [&_em]:italic',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-[var(--space-5)] [&_ol]:pl-[var(--space-5)]',
  '[&_li]:my-[var(--space-1)]',
  '[&_a]:text-[var(--color-primary)] [&_a]:underline',
  '[&_code]:rounded-[var(--radius-sm)] [&_code]:bg-[var(--color-surface-sunken)] [&_code]:px-[var(--space-1)]',
  '[&_blockquote]:border-l [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-[var(--space-3)]',
  '[&_blockquote]:text-[var(--color-text-muted)]',
]
